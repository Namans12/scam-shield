import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelContext, ModelContextTool } from "./modelContext";
import { makeResult } from "@/test/fixtures";

const checkContent = vi.hoisted(() => vi.fn());
const reportCheck = vi.hoisted(() => vi.fn());
const ensureAnonymousUser = vi.hoisted(() => vi.fn());
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, checkContent, reportCheck };
});
vi.mock("../firebase", async () => {
  const actual = await vi.importActual<typeof import("../firebase")>("../firebase");
  return { ...actual, ensureAnonymousUser };
});
import { ApiError } from "../api";
import { registerScamShieldTools, summariseCheck } from "./registerTools";

function fakeContext(): { mc: ModelContext; registered: ModelContextTool[] } {
  const registered: ModelContextTool[] = [];
  return { mc: { registerTool: (t) => void registered.push(t) }, registered };
}
const run = async (tools: ModelContextTool[], name: string, input: Record<string, unknown>) => {
  const res = await tools.find((t) => t.name === name)!.execute(input);
  const body = res.content[0]!.text;
  return { isError: !!res.isError, body, json: () => JSON.parse(body) };
};

beforeEach(() => {
  checkContent.mockReset();
  reportCheck.mockReset();
  ensureAnonymousUser.mockReset();
});

describe("registerScamShieldTools", () => {
  it("registers both tools and returns their names", () => {
    const { mc, registered } = fakeContext();
    expect(registerScamShieldTools(mc)).toEqual(["check_message", "report_scam"]);
    expect(registered.map((t) => t.name)).toEqual(["check_message", "report_scam"]);
  });

  it("is a no-op without WebMCP", () => {
    expect(registerScamShieldTools(undefined)).toEqual([]);
    expect(registerScamShieldTools({})).toEqual([]);
  });

  it("falls back to provideContext", () => {
    const provideContext = vi.fn();
    expect(registerScamShieldTools({ provideContext })).toEqual(["check_message", "report_scam"]);
    expect(provideContext.mock.calls[0]![0].tools).toHaveLength(2);
  });

  it("never throws when the browser API does", () => {
    expect(registerScamShieldTools({ registerTool: () => { throw new Error("nope"); } })).toEqual([]);
  });
});

describe("check_message", () => {
  it("checks the text and returns a summary with masked identifiers only", async () => {
    const { mc, registered } = fakeContext();
    registerScamShieldTools(mc);
    checkContent.mockResolvedValue(makeResult());
    const out = await run(registered, "check_message", { text: "  Your KYC is pending  ", lang: "hi" });
    expect(checkContent).toHaveBeenCalledWith({ text: "Your KYC is pending", lang: "hi" });
    const j = out.json();
    expect(j).toMatchObject({ checkId: "chk_123", verdict: "scam", canReport: true });
    expect(out.body).not.toContain("9876543210");
    expect(out.body).not.toMatch(/\bsafe\b/i);
    expect(j.disclaimer).toContain("1930");
  });

  it("rejects empty input and defaults to English", async () => {
    const { mc, registered } = fakeContext();
    registerScamShieldTools(mc);
    expect((await run(registered, "check_message", { text: "   " })).isError).toBe(true);
    checkContent.mockResolvedValue(makeResult());
    await run(registered, "check_message", { text: "x" });
    expect(checkContent).toHaveBeenCalledWith({ text: "x", lang: "en" });
  });

  it("returns an error result when the API fails", async () => {
    const { mc, registered } = fakeContext();
    registerScamShieldTools(mc);
    checkContent.mockRejectedValue(new ApiError("rate_limited", 429));
    const out = await run(registered, "check_message", { text: "x" });
    expect(out.isError).toBe(true);
    expect(out.body).toContain("rate limiting");
  });
});

describe("report_scam", () => {
  it("asks for a Google sign-in when the person is anonymous", async () => {
    const { mc, registered } = fakeContext();
    registerScamShieldTools(mc);
    ensureAnonymousUser.mockResolvedValue({ providerData: [] });
    const out = await run(registered, "report_scam", { checkId: "chk_123" });
    expect(out.isError).toBe(true);
    expect(out.body).toContain("sign in with Google");
    expect(reportCheck).not.toHaveBeenCalled();
  });

  it("reports for a Google user and masks what was added", async () => {
    const { mc, registered } = fakeContext();
    registerScamShieldTools(mc);
    ensureAnonymousUser.mockResolvedValue({ providerData: [{ providerId: "google.com" }] });
    reportCheck.mockResolvedValue({ reportId: "r", entityKeys: ["phone:+917000011111"] });
    const out = await run(registered, "report_scam", { checkId: "chk_123" });
    expect(reportCheck).toHaveBeenCalledWith("chk_123");
    expect(out.json()).toMatchObject({ reported: true, identifiersAdded: ["+91 70XXXXX111"] });
  });

  it("explains known failures", async () => {
    const { mc, registered } = fakeContext();
    registerScamShieldTools(mc);
    ensureAnonymousUser.mockResolvedValue({ providerData: [{ providerId: "google.com" }] });
    reportCheck.mockRejectedValue(new ApiError("not_reportable", 409));
    expect((await run(registered, "report_scam", { checkId: "x" })).body).toContain("warning signs");
    expect((await run(registered, "report_scam", {})).isError).toBe(true);
  });
});

describe("summariseCheck", () => {
  it("offers no report when nothing was found", () => {
    expect(summariseCheck(makeResult({ verdict: "no_signs", entityKeys: [] })).canReport).toBe(false);
  });
});
