// Exposes Scam Shield to in-browser AI agents through WebMCP. Two tools: check a message, and report a scam.
// Results carry only masked identifiers and the same guidance-only framing as the page.
import { maskIdentifier } from "@scam-shield/shared/mask";
import type { CheckResult, Lang } from "@scam-shield/shared";
import { ApiError, checkContent, reportCheck } from "../api";
import { ensureAnonymousUser, isGoogleUser } from "../firebase";
import type { ModelContext, ModelContextTool, ToolResult } from "./modelContext";

const MAX_TEXT = 5000;
const DISCLAIMER = "Guidance only. If money was lost, call 1930 immediately.";

const text = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
  ...(isError && { isError: true }),
});

/** What an agent gets back from a check: the verdict and reasons, never raw phone numbers or UPI IDs. */
export function summariseCheck(r: CheckResult) {
  return {
    checkId: r.id,
    verdict: r.verdict, // "scam" | "suspicious" | "no_signs" (no scam signs found; never a guarantee)
    riskScore: r.risk_score,
    scamType: r.scam_type,
    summary: r.summary,
    redFlags: r.red_flags.map((f) => ({ flag: f.flag, evidence: f.evidence })),
    nextSteps: r.next_steps,
    reportedBefore: r.hits.map((h) => ({ identifier: maskIdentifier(h.key), reportedTimes: h.reportCount })),
    canReport: r.verdict !== "no_signs" && r.entityKeys.length > 0,
    disclaimer: DISCLAIMER,
  };
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "rate_limited" || e.code === "daily_limit") return "Scam Shield is rate limiting this browser. Try again later.";
    if (e.code === "analysis_failed") return "The analysis failed. Try again.";
    if (e.code === "network") return "Could not reach Scam Shield.";
  }
  return "Something went wrong.";
}

export const tools: ModelContextTool[] = [
  {
    name: "check_message",
    description:
      "Check a suspicious SMS, WhatsApp message, email or link for scam warning signs. Returns a verdict (scam, suspicious or no_signs), the red flags with evidence, and next steps. Guidance only: no_signs never means safe.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The message or link to check (up to 5000 characters).", maxLength: MAX_TEXT },
        lang: { type: "string", enum: ["en", "hi"], description: "Language of the answer. Default en." },
      },
      required: ["text"],
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const raw = typeof input.text === "string" ? input.text.trim() : "";
      if (!raw) return text("Provide the message to check in `text`.", true);
      const lang: Lang = input.lang === "hi" ? "hi" : "en";
      try {
        return text(summariseCheck(await checkContent({ text: raw.slice(0, MAX_TEXT), lang })));
      } catch (e) {
        return text(errorText(e), true);
      }
    },
  },
  {
    name: "report_scam",
    description:
      "Add the phone numbers, UPI IDs and links from a checked scam to Scam Shield's shared scam list. Needs the checkId from check_message and a person signed in with Google on this page; if not, this tells you to ask the person to sign in.",
    inputSchema: {
      type: "object",
      properties: { checkId: { type: "string", description: "The checkId returned by check_message." } },
      required: ["checkId"],
    },
    async execute(input) {
      const checkId = typeof input.checkId === "string" ? input.checkId.trim() : "";
      if (!checkId) return text("Provide the checkId from check_message.", true);
      try {
        const user = await ensureAnonymousUser();
        if (!isGoogleUser(user)) {
          return text("The person must sign in with Google first: ask them to open the Report this scam button on the result page. Reports need a Google sign-in to limit fake reports.", true);
        }
        const res = await reportCheck(checkId);
        return text({ reported: true, identifiersAdded: res.entityKeys.map((k) => maskIdentifier(k)), note: "Added to the scam list. Reports are counted, not proof." });
      } catch (e) {
        if (e instanceof ApiError && e.code === "google_sign_in_required") return text("The person must sign in with Google first.", true);
        if (e instanceof ApiError && e.code === "not_reportable") return text("Only checks that found warning signs can be reported.", true);
        if (e instanceof ApiError && e.code === "no_identifiers") return text("That check has no phone number, UPI ID or link to add.", true);
        return text(errorText(e), true);
      }
    },
  },
];

/** Registers the tools with the browser's WebMCP implementation. Returns the names registered ([] when there is none). */
export function registerScamShieldTools(mc: ModelContext | undefined): string[] {
  if (!mc) return [];
  try {
    if (typeof mc.registerTool === "function") {
      for (const t of tools) mc.registerTool(t);
    } else if (typeof mc.provideContext === "function") {
      mc.provideContext({ tools });
    } else return [];
    return tools.map((t) => t.name);
  } catch {
    return []; // an agent API that misbehaves must never break the page
  }
}
