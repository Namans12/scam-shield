import { describe, expect, it, vi } from "vitest";
import type { GeminiVerdict } from "@scam-shield/shared";
import type { ExtractedEntities } from "./extract";
import { AnalysisError, createGeminiModel, type AnalyzeInput } from "./gemini";

const empty: ExtractedEntities = { phones: [], upiIds: [], urls: [], domains: [], bankAccounts: [] };
const good: GeminiVerdict = {
  verdict: "scam", risk_score: 90, scam_type: "kyc_update", summary: "KYC scam",
  red_flags: [{ flag: "urgency", evidence: "BLOCKED today", why_it_matters: "pressure" }], next_steps: ["Do not click"],
  entities: { phones: [], upi_ids: [], urls: [], bank_accounts: [], brands_impersonated: [] }, language: "en",
};
const cfg = { project: "p", location: "global", model: "m", combinedGrounding: true };
const input: AnalyzeInput = { text: "hello", lang: "en", entities: empty, hits: [] };
const urlInput: AnalyzeInput = { text: "see x.web.app", lang: "en", entities: { ...empty, domains: ["x.web.app"] }, hits: [] };

function fake(impl: (args: any) => Promise<{ text?: string }>) {
  const generateContent = vi.fn(impl);
  return { client: { models: { generateContent } }, generateContent };
}

describe("createGeminiModel.analyze", () => {
  it("returns the parsed verdict for valid JSON", async () => {
    const { client } = fake(async () => ({ text: JSON.stringify(good) }));
    expect(await createGeminiModel(cfg, client).analyze(input)).toEqual(good);
  });
  it("fills schema defaults for omitted arrays", async () => {
    const { client } = fake(async () => ({ text: JSON.stringify({ verdict: "no_signs", risk_score: 5, scam_type: "none", summary: "s", language: "en" }) }));
    const v = await createGeminiModel(cfg, client).analyze(input);
    expect(v.red_flags).toEqual([]);
    expect(v.entities.phones).toEqual([]);
  });
  it("throws AnalysisError for non-JSON", async () => {
    const { client } = fake(async () => ({ text: "not json" }));
    await expect(createGeminiModel(cfg, client).analyze(input)).rejects.toBeInstanceOf(AnalysisError);
  });
  it("throws AnalysisError for schema-invalid JSON", async () => {
    const { client } = fake(async () => ({ text: JSON.stringify({ verdict: "maybe" }) }));
    await expect(createGeminiModel(cfg, client).analyze(input)).rejects.toBeInstanceOf(AnalysisError);
  });
  it("throws AnalysisError for empty text", async () => {
    const { client } = fake(async () => ({}));
    await expect(createGeminiModel(cfg, client).analyze(input)).rejects.toBeInstanceOf(AnalysisError);
  });
  it("throws AnalysisError when the client rejects", async () => {
    const { client } = fake(async () => { throw new Error("boom"); });
    await expect(createGeminiModel(cfg, client).analyze(input)).rejects.toBeInstanceOf(AnalysisError);
  });
  it("combined mode: one call, search tool + JSON schema when there is something to look up", async () => {
    const { client, generateContent } = fake(async () => ({ text: JSON.stringify(good) }));
    await createGeminiModel(cfg, client).analyze(urlInput);
    expect(generateContent).toHaveBeenCalledTimes(1);
    const c = generateContent.mock.calls[0][0].config;
    expect(c.tools).toEqual([{ googleSearch: {} }]);
    expect(c.responseMimeType).toBe("application/json");
    expect(c.responseJsonSchema).toBeTruthy();
  });
  it("combined mode: omits the search tool when nothing to look up", async () => {
    const { client, generateContent } = fake(async () => ({ text: JSON.stringify(good) }));
    await createGeminiModel(cfg, client).analyze(input);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].config.tools).toBeUndefined();
  });
  it("two-call mode: grounding call first, notes fed into the JSON call", async () => {
    const { client, generateContent } = fake(async (a) => (a.config.tools ? { text: "GROUNDING-NOTES-XYZ" } : { text: JSON.stringify(good) }));
    await createGeminiModel({ ...cfg, combinedGrounding: false }, client).analyze(urlInput);
    expect(generateContent).toHaveBeenCalledTimes(2);
    const [g, j] = generateContent.mock.calls.map((c) => c[0]);
    expect(g.config.tools).toEqual([{ googleSearch: {} }]);
    expect(g.config.responseMimeType).toBeUndefined();
    expect(j.config.tools).toBeUndefined();
    expect(JSON.stringify(j.contents)).toContain("GROUNDING-NOTES-XYZ");
  });
  it("two-call mode: skips the grounding call when nothing to look up", async () => {
    const { client, generateContent } = fake(async () => ({ text: JSON.stringify(good) }));
    await createGeminiModel({ ...cfg, combinedGrounding: false }, client).analyze(input);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it("sends media as fileData and the link screenshot as inlineData", async () => {
    const { client, generateContent } = fake(async () => ({ text: JSON.stringify(good) }));
    await createGeminiModel(cfg, client).analyze({
      ...input, media: { gcsUri: "gs://b/o.png", mimeType: "image/png" },
      linkScan: { requestedUrl: "https://a.in", redirects: [], screenshotDataUrl: "data:image/jpeg;base64,QUJD" },
    });
    const parts = generateContent.mock.calls[0][0].contents[0].parts;
    expect(parts.some((p: any) => p.fileData?.fileUri === "gs://b/o.png" && p.fileData.mimeType === "image/png")).toBe(true);
    expect(parts.some((p: any) => p.inlineData?.data === "QUJD" && p.inlineData.mimeType === "image/jpeg")).toBe(true);
  });
  it("aborts after the timeout", async () => {
    vi.useFakeTimers();
    try {
      const { client } = fake(() => new Promise(() => {}));
      const p = createGeminiModel(cfg, client).analyze(input);
      const assertion = expect(p).rejects.toBeInstanceOf(AnalysisError);
      await vi.advanceTimersByTimeAsync(30_001);
      await assertion;
    } finally { vi.useRealTimers(); }
  });
});
