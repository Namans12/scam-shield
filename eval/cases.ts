import { readFileSync } from "node:fs";
import { SCAM_TYPES, type ScamType } from "@scam-shield/shared";
import type { Label } from "./metrics";

export interface Case {
  id: string;
  kind: "text" | "image" | "audio";
  label: Label;
  scam_type?: ScamType;
  text?: string;
  asset?: string;
  mime?: string;
  /** v2: adversarial | lookalike | ambiguous; v3: "realistic_scam" or the topic of a genuine message */
  category?: string;
  expect?: "flagged" | "not_flagged" | "any_not_scam";
  tactic?: string;
}

export function loadCases(path: string): Case[] {
  return readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Case);
}

/** Returns a list of problems (empty = valid). The label "safe" is never allowed: a tool cannot certify a message safe. */
export function validateCases(cases: Case[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const c of cases) {
    const where = `case ${c.id}`;
    if (!c.id || typeof c.id !== "string") problems.push("case without id");
    if (ids.has(c.id)) problems.push(`${where}: duplicate id`);
    ids.add(c.id);
    if (!["text", "image", "audio"].includes(c.kind)) problems.push(`${where}: bad kind ${String(c.kind)}`);
    if (!["scam", "legit", "ambiguous"].includes(c.label)) problems.push(`${where}: bad label ${String(c.label)}`);
    if (c.kind === "text" && !c.text?.trim()) problems.push(`${where}: text case without text`);
    if (c.kind !== "text" && (!c.asset || !c.mime)) problems.push(`${where}: ${c.kind} case needs asset and mime`);
    if (c.label === "scam" && !(c.scam_type && (SCAM_TYPES as readonly string[]).includes(c.scam_type) && c.scam_type !== "none")) problems.push(`${where}: scam needs a real scam_type`);
    if (c.label !== "scam" && c.scam_type) problems.push(`${where}: only scams carry a scam_type`);
    if (c.expect) {
      const want = { scam: "flagged", legit: "not_flagged", ambiguous: "any_not_scam" }[c.label];
      if (c.expect !== want) problems.push(`${where}: expect ${c.expect} does not match label ${c.label}`);
    }
  }
  return problems;
}
