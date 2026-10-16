import { GoogleGenAI } from "@google/genai";
import { GEMINI_RESPONSE_JSON_SCHEMA, geminiVerdictSchema } from "@scam-shield/shared";
import type { EntityHit, GeminiVerdict, Lang, LinkScan, QrInfo } from "@scam-shield/shared";
import type { ExtractedEntities } from "./extract";
import { buildGroundingPrompt, buildVerdictPrompt } from "./prompt";

export interface AnalyzeInput {
  text?: string;
  media?: { gcsUri: string; mimeType: string };
  lang: Lang;
  entities: ExtractedEntities;
  hits: EntityHit[];
  qr?: QrInfo;
  linkScan?: LinkScan;
}

export interface VerdictModel {
  /** Throws AnalysisError on any failure (network, timeout, malformed or schema-invalid output). */
  analyze(input: AnalyzeInput): Promise<GeminiVerdict>;
}

export class AnalysisError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AnalysisError";
  }
}

export interface GeminiConfig { project: string; location: string; model: string; combinedGrounding: boolean }

/** The slice of the @google/genai client we use; lets tests inject a fake. */
export interface GenAiClient {
  models: { generateContent(params: { model: string; contents: unknown; config?: Record<string, unknown> }): Promise<{ text?: string }> };
}

export const ANALYZE_TIMEOUT_MS = 30_000;

function buildParts(prompt: string, input: AnalyzeInput): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (input.media) parts.push({ fileData: { fileUri: input.media.gcsUri, mimeType: input.media.mimeType } });
  const shot = input.linkScan?.screenshotDataUrl?.match(/^data:(image\/jpeg);base64,(.+)$/s);
  if (shot) parts.push({ inlineData: { mimeType: shot[1], data: shot[2] } });
  return parts;
}

export function createGeminiModel(cfg: GeminiConfig, client?: GenAiClient): VerdictModel {
  const ai: GenAiClient = client ?? (new GoogleGenAI({ vertexai: true, project: cfg.project, location: cfg.location }) as unknown as GenAiClient);

  async function run(input: AnalyzeInput, signal: AbortSignal): Promise<GeminiVerdict> {
    const groundingPrompt = buildGroundingPrompt(input);
    let notes: string | undefined;
    const config: Record<string, unknown> = {
      abortSignal: signal,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: GEMINI_RESPONSE_JSON_SCHEMA,
    };

    if (groundingPrompt) {
      if (cfg.combinedGrounding) {
        // Structured output and Google Search in a single call (supported by gemini-3.x).
        config.tools = [{ googleSearch: {} }];
      } else {
        const g = await ai.models.generateContent({
          model: cfg.model,
          contents: [{ role: "user", parts: [{ text: groundingPrompt }] }],
          config: { abortSignal: signal, temperature: 0.2, tools: [{ googleSearch: {} }] },
        });
        notes = g.text?.trim() || undefined;
      }
    }

    const res = await ai.models.generateContent({
      model: cfg.model,
      contents: [{ role: "user", parts: buildParts(buildVerdictPrompt(input, notes), input) }],
      config,
    });
    const raw = res.text;
    if (!raw?.trim()) throw new AnalysisError("Model returned no text");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (cause) {
      throw new AnalysisError("Model returned invalid JSON", { cause });
    }
    const parsed = geminiVerdictSchema.safeParse(json);
    if (!parsed.success) throw new AnalysisError(`Model output failed schema validation: ${parsed.error.message}`, { cause: parsed.error });
    return parsed.data;
  }

  return {
    async analyze(input) {
      const ctrl = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ctrl.abort();
          reject(new AnalysisError(`Analysis timed out after ${ANALYZE_TIMEOUT_MS / 1000}s`));
        }, ANALYZE_TIMEOUT_MS);
      });
      try {
        return await Promise.race([run(input, ctrl.signal), timeout]);
      } catch (e) {
        if (e instanceof AnalysisError) throw e;
        throw new AnalysisError(`Gemini call failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
