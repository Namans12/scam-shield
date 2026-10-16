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

export interface GeminiConfig {
  project: string; location: string; model: string; combinedGrounding: boolean;
  /** Gemini 3 thinking level; unset leaves the model default (slower, ~3x). */
  thinkingLevel?: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
}

/** The slice of the @google/genai client we use; lets tests inject a fake. */
export interface GenAiClient {
  models: { generateContent(params: { model: string; contents: unknown; config?: Record<string, unknown> }): Promise<{ text?: string }> };
}

/** First attempt (with Google Search, which hangs on about 1 call in 4) is cut off here; the retry skips the search. */
export const ATTEMPT_TIMEOUT_MS = 15_000;
/** Everything (both attempts) must finish by this point. */
export const ANALYZE_TIMEOUT_MS = 40_000;
/** No retry is started with less than this left. */
const MIN_RETRY_MS = 8_000;
const RETRY_DELAY_MS = 300;

function buildParts(prompt: string, input: AnalyzeInput): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (input.media) parts.push({ fileData: { fileUri: input.media.gcsUri, mimeType: input.media.mimeType } });
  const shot = input.linkScan?.screenshotDataUrl?.match(/^data:(image\/jpeg);base64,(.+)$/s);
  if (shot) parts.push({ inlineData: { mimeType: shot[1], data: shot[2] } });
  return parts;
}

export function createGeminiModel(cfg: GeminiConfig, client?: GenAiClient): VerdictModel {
  const ai: GenAiClient = client ?? (new GoogleGenAI({ vertexai: true, project: cfg.project, location: cfg.location }) as unknown as GenAiClient);

  async function run(input: AnalyzeInput, signal: AbortSignal, grounded: boolean): Promise<GeminiVerdict> {
    const groundingPrompt = grounded ? buildGroundingPrompt(input) : undefined;
    let notes: string | undefined;
    const config: Record<string, unknown> = {
      abortSignal: signal,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: GEMINI_RESPONSE_JSON_SCHEMA,
      ...(cfg.thinkingLevel && { thinkingConfig: { thinkingLevel: cfg.thinkingLevel } }),
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

  /** One bounded attempt. Rejects with AnalysisError(kind) so the caller can decide whether to retry. */
  async function attempt(input: AnalyzeInput, ms: number, grounded: boolean): Promise<GeminiVerdict> {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new AnalysisError(`Analysis timed out after ${Math.round(ms / 1000)}s`, { cause: new TimeoutMarker() }));
      }, ms);
    });
    try {
      return await Promise.race([run(input, ctrl.signal, grounded), timeout]);
    } catch (e) {
      if (e instanceof AnalysisError) throw e;
      throw new AnalysisError(`Gemini call failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async analyze(input) {
      const started = Date.now();
      let first: unknown;
      try {
        return await attempt(input, Math.min(ATTEMPT_TIMEOUT_MS, ANALYZE_TIMEOUT_MS), true);
      } catch (e) {
        first = e;
      }
      logAttemptFailure(1, first);
      const left = ANALYZE_TIMEOUT_MS - (Date.now() - started) - RETRY_DELAY_MS;
      if (!isTransient(first) || left < MIN_RETRY_MS) throw first;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        // Google Search grounding is the usual culprit (project quota gives 429s after a few calls, and it can hang):
        // the retry skips it, so a link still gets a verdict, just without the web lookup.
        return await attempt(input, left, false);
      } catch (e) {
        logAttemptFailure(2, e);
        throw e;
      }
    },
  };
}

class TimeoutMarker extends Error {}

/** Client errors (bad request, auth, not found...) will fail again; everything else is worth one more try. */
function isTransient(e: unknown): boolean {
  const status = statusOf(e);
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
}

function statusOf(e: unknown): number | undefined {
  const cause = e instanceof AnalysisError ? e.cause : e;
  const st = (cause as { status?: unknown; code?: unknown } | undefined)?.status ?? (cause as { code?: unknown } | undefined)?.code;
  return typeof st === "number" ? st : undefined;
}

/** Logs what failed without any user content: error class, HTTP status and the first words of an API error message. */
function logAttemptFailure(n: number, e: unknown): void {
  const cause = e instanceof AnalysisError ? e.cause : e;
  const kind = cause instanceof TimeoutMarker ? "timeout" : cause instanceof Error ? cause.name : e instanceof AnalysisError ? "invalid_output" : "unknown";
  const status = statusOf(e);
  const msg = e instanceof AnalysisError && !(cause instanceof Error) ? e.message : cause instanceof Error && kind !== "ZodError" && kind !== "SyntaxError" ? cause.message : "";
  console.error(`scam-shield: gemini_attempt_failed attempt=${n} kind=${kind}${status !== undefined ? ` status=${status}` : ""}${msg ? ` msg=${JSON.stringify(msg.slice(0, 160))}` : ""}`);
}
