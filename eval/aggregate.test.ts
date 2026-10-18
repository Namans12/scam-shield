// Tests for eval/aggregate.ts: number formatting, combining runs, strict joining of raw rows to cases, the generated files,
// and the committed official data. Synthetic data only (seeded, no network); the last block reads the committed results.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { aggregate, buildGenerated, formatPct, joinRun, loadOfficialRuns, renderCombined, renderGeneratedJson, type RunData } from "./aggregate";
import { countRows, type EvalRow } from "./metrics";
import type { Case } from "./cases";
import { buildDataset, mulberry32, shuffle, type Plan } from "./synth";
import { refCounts, refPctString } from "./reference-metrics";

const here = dirname(fileURLToPath(import.meta.url));

describe("formatPct", () => {
  it.each([
    [0, 0, "0"], [0, 5, "0"], [5, 5, "100"], [1000, 1000, "100"],
    [1, 3, "33.3"], [2, 3, "66.7"], [1, 6, "16.7"],
    [9996, 10000, "99.9"], // never rounds up to 100
    [99995, 100000, "99.9"], [999, 1000, "99.9"], [1999, 2000, "99.9"],
    [4, 10000, "0.1"], [1, 100000, "0.1"], [1, 2000, "0.1"], // never rounds down to 0
    [1, 4, "25.0"], [1, 20, "5.0"], [1, 8, "12.5"],
    [1, 16, "6.3"], [3, 16, "18.8"], [5, 16, "31.3"], // exact ties go up (6.25, 18.75, 31.25)
    [1, 40, "2.5"], [41, 42, "97.6"], [83, 85, "97.6"], [1, 10, "10.0"],
    [995, 1000, "99.5"], [996, 1000, "99.6"],
  ])("%i of %i is %s", (num, den, want) => expect(formatPct(num, den)).toBe(want));

  it("the example from the brief: 5 false positives in 100 genuine is 5.0", () => expect(formatPct(5, 100)).toBe("5.0"));

  it("rejects impossible input", () => {
    expect(() => formatPct(-1, 5)).toThrow(RangeError);
    expect(() => formatPct(6, 5)).toThrow(RangeError);
    expect(() => formatPct(1.5, 5)).toThrow(RangeError);
    expect(() => formatPct(1, Number.NaN)).toThrow(RangeError);
  });

  it("matches an independent integer reference for every fraction with a denominator up to 400", () => {
    for (let den = 1; den <= 400; den++) for (let num = 0; num <= den; num++) expect(formatPct(num, den), `${num}/${den}`).toBe(refPctString(num, den));
  });

  it("invariants over every fraction up to 300: a miss always shows, one decimal, monotonic, close to the true value", () => {
    for (let den = 1; den <= 300; den++) {
      let prev = -1;
      for (let num = 0; num <= den; num++) {
        const s = formatPct(num, den);
        expect(s).toMatch(/^(0|100|\d{1,2}\.\d)$/);
        if (num === 0) expect(s).toBe("0");
        if (num > 0) expect(s).not.toBe("0");
        if (num < den) expect(s).not.toBe("100");
        if (num === den) expect(s).toBe("100");
        const v = Number(s);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
        expect(Math.abs(v - (100 * num) / den)).toBeLessThanOrEqual(0.0501 + 1e-9 + (num > 0 && num < den ? 0.05 : 0));
      }
    }
  });

  it("is exact on large counts (no floating-point drift): 99,999,999 of 100,000,000 is 99.9; 1 of 3 million is 0.1", () => {
    expect(formatPct(99_999_999, 100_000_000)).toBe("99.9");
    expect(formatPct(1, 3_000_000)).toBe("0.1");
    expect(formatPct(33_333_333, 100_000_000)).toBe("33.3");
  });
});

// ---------- aggregation over large synthetic runs ----------

const RUN_PLANS: Plan[] = [
  { seed: 101, idPrefix: "a", scamsCaught: 12_000, typeWrong: 700, scamsMissed: 40, scamsErrors: 3, legitFlagged: 90, legitCleared: 11_500, legitErrors: 7, ambScam: 2, ambSuspicious: 40, ambNoSigns: 90 },
  { seed: 102, idPrefix: "b", scamsCaught: 20_000, typeWrong: 1_000, scamsMissed: 11, legitFlagged: 5, legitCleared: 19_900, ambNoSigns: 14 },
  { seed: 103, idPrefix: "c", scamsCaught: 17_988, scamsMissed: 2, scamsErrors: 1, legitFlagged: 4, legitCleared: 17_000, legitErrors: 2, ambSuspicious: 5, ambErrors: 1 },
];

function runsFrom(plans: Plan[]): RunData[] {
  return plans.map((p, i) => ({ name: `run${i + 1}`, runAt: `2026-10-1${i + 5}T00:00:00.000Z`, base: "https://x.example", rows: buildDataset(p).rows }));
}

describe("aggregate over three large runs", () => {
  const runs = runsFrom(RUN_PLANS);
  const all = runs.flatMap((r) => r.rows);
  const sum = (f: (p: Plan) => number) => RUN_PLANS.reduce((s, p) => s + f(p), 0);
  const caught = sum((p) => p.scamsCaught ?? 0);
  const missed = sum((p) => p.scamsMissed ?? 0);
  const sErr = sum((p) => p.scamsErrors ?? 0);
  const lFlag = sum((p) => p.legitFlagged ?? 0);
  const lClear = sum((p) => p.legitCleared ?? 0);
  const lErr = sum((p) => p.legitErrors ?? 0);
  const amb = sum((p) => (p.ambScam ?? 0) + (p.ambSuspicious ?? 0) + (p.ambNoSigns ?? 0) + (p.ambErrors ?? 0));
  const scams = caught + missed + sErr;
  const legit = lFlag + lClear + lErr;
  const agg = aggregate(runs);

  it("has about 100,000 rows (98,705) and the by-construction counts", () => {
    expect(all.length).toBe(98_705);
    expect(agg.overall).toMatchObject({ total: scams + legit + amb, scams, legit, ambiguous: amb, scored: scams + legit, errors: sErr + lErr, correct: caught + lClear, scamsFlagged: caught, legitFlagged: lFlag, legitAnswered: lFlag + lClear });
  });

  it("headline strings equal the by-construction percentages", () => {
    const g = buildGenerated(agg);
    expect(g).toEqual({
      accuracy: refPctString(caught + lClear, scams + legit),
      recall: refPctString(caught, scams),
      falsePositive: refPctString(lFlag, lFlag + lClear),
      cases: String(scams + legit + amb), scams: String(scams), genuine: String(legit), ambiguous: String(amb),
    });
    expect(g.recall).toBe("99.9"); // 49,988 of 50,045 scams caught is 99.886 percent
    expect(g.falsePositive).toBe("0.2");
  });

  it("combining three runs equals computing on the concatenation, and equals the brute-force reference", () => {
    expect(agg.overall).toEqual(countRows(all));
    expect(agg.overall).toEqual(refCounts(all));
    const oneBig = aggregate([{ name: "all", runAt: "2026-10-18T00:00:00.000Z", base: "", rows: all }]);
    expect(buildGenerated(oneBig)).toEqual(buildGenerated(agg));
    expect(oneBig.latency).toEqual(agg.latency);
    expect(oneBig.latencyAll).toEqual(agg.latencyAll);
  });

  it("is independent of run order and of row order", () => {
    const base = buildGenerated(agg);
    for (const order of [[2, 1, 0], [1, 2, 0], [0, 2, 1]]) expect(buildGenerated(aggregate(order.map((i) => runs[i]!)))).toEqual(base);
    const rnd = mulberry32(7);
    const reshuffled = runs.map((r) => ({ ...r, rows: shuffle(r.rows.slice(), rnd) }));
    const again = aggregate(reshuffled);
    expect(buildGenerated(again)).toEqual(base);
    expect(again.latency).toEqual(agg.latency);
    expect(again.overall).toEqual(agg.overall);
  });

  it("per-run, per-category and per-scam-type groups add up to the overall counts", () => {
    const add = (gs: Array<{ counts: ReturnType<typeof countRows> }>, k: keyof ReturnType<typeof countRows>) => gs.reduce((s, g) => s + g.counts[k], 0);
    for (const k of ["total", "scams", "legit", "ambiguous", "scored", "correct", "scamsFlagged", "legitFlagged", "legitAnswered", "errors", "typeHits"] as const) {
      expect(add(agg.perRun, k)).toBe(agg.overall[k]);
      expect(add(agg.perCategory, k)).toBe(agg.overall[k]);
    }
    expect(add(agg.perScamType, "scams")).toBe(scams);
    expect(add(agg.perScamType, "scamsFlagged")).toBe(caught);
    expect(agg.perRun.map((g) => g.counts.total)).toEqual(RUN_PLANS.map((p) => buildDataset(p).expected.total));
  });

  it("a single extra miss moves recall off 100 and a single false positive moves the rate off 0", () => {
    const perfect = aggregate(runsFrom([{ seed: 1, idPrefix: "p", scamsCaught: 50_000, legitCleared: 50_000 }]));
    expect(buildGenerated(perfect)).toMatchObject({ accuracy: "100", recall: "100", falsePositive: "0" });
    const oneMiss = aggregate(runsFrom([{ seed: 1, idPrefix: "p", scamsCaught: 49_999, scamsMissed: 1, legitFlagged: 1, legitCleared: 49_999 }]));
    expect(buildGenerated(oneMiss)).toMatchObject({ accuracy: "99.9", recall: "99.9", falsePositive: "0.1" }); // 99.998 percent and 0.002 percent
  });

  it("a scam whose call errored is a miss, and a genuine message that errored is wrong but not a false positive", () => {
    const g = buildGenerated(aggregate(runsFrom([{ seed: 5, idPrefix: "e", scamsCaught: 90, scamsErrors: 10, legitCleared: 95, legitErrors: 5 }])));
    expect(g.recall).toBe("90.0");
    expect(g.falsePositive).toBe("0");
    expect(g.accuracy).toBe(refPctString(185, 200));
  });
});

// ---------- duplicates and joining ----------

const caseOf = (id: string, label: Case["label"], extra: Partial<Case> = {}): Case => ({ id, kind: "text", label, text: "x", ...(label === "scam" ? { scam_type: "kyc_update" as const } : {}), ...extra });
const rowOf = (id: string, label: EvalRow["label"], verdict: EvalRow["verdict"] = "no_signs", extra: Partial<EvalRow> = {}): EvalRow & Record<string, unknown> => ({ id, label, kind: "text", verdict, latencyMs: 1000, ...extra });

describe("duplicate and malformed data is rejected, not silently counted", () => {
  const mk = (name: string, ids: string[]): RunData => ({ name, runAt: "2026-10-18T00:00:00.000Z", base: "", rows: ids.map((id) => ({ id, label: "legit" as const, kind: "text", verdict: "no_signs" as const })) });

  it("the same case id in two runs throws and names both runs", () => {
    expect(() => aggregate([mk("v1", ["x1", "x2"]), mk("v2", ["x2", "x3"])])).toThrow(/duplicate case id x2 in runs v1 and v2/);
  });
  it("accepts disjoint ids", () => {
    expect(aggregate([mk("v1", ["x1", "x2"]), mk("v2", ["x3"])]).overall.total).toBe(3);
  });
  it("a duplicate id inside one raw file throws", () => {
    expect(() => joinRun("v1", [rowOf("a", "legit"), rowOf("a", "legit")], [caseOf("a", "legit")])).toThrow(/duplicate id inside the run/);
  });
  it("a raw row without a case throws", () => {
    expect(() => joinRun("v1", [rowOf("zz", "legit")], [caseOf("a", "legit")])).toThrow(/no such case/);
  });
  it("a case without a raw row (partial run) throws", () => {
    expect(() => joinRun("v1", [rowOf("a", "legit")], [caseOf("a", "legit"), caseOf("b", "legit")])).toThrow(/1 cases have no result row \(b\)/);
  });
  it("a label, kind, category or scam type that disagrees with the case file throws", () => {
    expect(() => joinRun("v1", [rowOf("a", "scam")], [caseOf("a", "legit")])).toThrow(/label scam in the raw file but legit/);
    expect(() => joinRun("v1", [rowOf("a", "legit", "no_signs", { kind: "image" })], [caseOf("a", "legit")])).toThrow(/kind image/);
    expect(() => joinRun("v1", [rowOf("a", "legit", "no_signs", { category: "lookalike" })], [caseOf("a", "legit", { category: "adversarial" })])).toThrow(/category mismatch/);
    expect(() => joinRun("v1", [rowOf("a", "scam", "scam", { scamType: "job_task" })], [caseOf("a", "scam")])).toThrow(/scam type mismatch/);
  });
  it("a row with neither verdict nor error throws", () => {
    expect(() => joinRun("v1", [{ id: "a", label: "legit", kind: "text" }], [caseOf("a", "legit")])).toThrow(/neither a verdict nor an error/);
  });
  it("takes label, category and scam type from the case file when the raw row lacks them", () => {
    const [r] = joinRun("v1", [{ id: "a", label: "scam", kind: "text", verdict: "scam", predictedType: "kyc_update" }], [caseOf("a", "scam", { category: "adversarial" })]);
    expect(r).toMatchObject({ label: "scam", category: "adversarial", scamType: "kyc_update" });
  });
});

// ---------- the file path: manifest -> raw files -> case files, at 10,000 rows per run ----------

describe("loadOfficialRuns reads a manifest of raw files and case files", () => {
  const dir = mkdtempSync(join(tmpdir(), "aggregate-test-"));
  mkdirSync(join(dir, "results"));
  const plans: Plan[] = [
    { seed: 31, idPrefix: "p", scamsCaught: 3_300, typeWrong: 100, scamsMissed: 12, legitFlagged: 8, legitCleared: 3_300, ambNoSigns: 20, ambScam: 1 },
    { seed: 32, idPrefix: "q", scamsCaught: 3_300, scamsMissed: 3, scamsErrors: 1, legitFlagged: 0, legitCleared: 3_390, legitErrors: 2 },
    { seed: 33, idPrefix: "r", scamsCaught: 3_300, scamsMissed: 0, legitFlagged: 1, legitCleared: 3_300, ambSuspicious: 3 },
  ];
  const manifest = { runs: [] as unknown[] };
  const all: EvalRow[] = [];
  plans.forEach((p, i) => {
    const { rows } = buildDataset(p);
    all.push(...rows);
    const cases: Case[] = rows.map((r) => ({ id: r.id, kind: "text", label: r.label, text: "t", ...(r.scamType && { scam_type: r.scamType }), ...(r.category && { category: r.category }) }));
    writeFileSync(join(dir, `cases-${i}.jsonl`), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
    // Raw rows deliberately omit label-derived fields except for label and kind, like the oldest real raw file does.
    const raw = rows.map(({ category: _c, scamType: _s, ...rest }) => ({ ...rest, kind: "text" }));
    writeFileSync(join(dir, "results", `run-${i}.raw.json`), JSON.stringify({ base: "https://x.example", rows: raw }));
    manifest.runs.push({ name: `r${i}`, raw: `run-${i}.raw.json`, cases: `../cases-${i}.jsonl`, runAt: `2026-10-1${i}T00:00:00.000Z` });
  });
  // kinds are all "text" in the files here, so align the reference rows
  const allText = all.map((r) => ({ ...r, kind: "text" }));
  writeFileSync(join(dir, "results", "official.json"), JSON.stringify(manifest));

  it("combines 3 x ~10,000 rows to exactly the by-construction counts", () => {
    const runs = loadOfficialRuns(join(dir, "results", "official.json"));
    expect(runs).toHaveLength(3);
    const agg = aggregate(runs);
    expect(agg.overall).toEqual(refCounts(allText));
    expect(agg.overall.total).toBe(19_941);
    expect(buildGenerated(agg).recall).toBe(refPctString(9_900, 9_900 + 15 + 1));
  });

  it("rejects a manifest that lists a raw file twice, a run name twice, or a changed runAt", () => {
    const write = (m: unknown, name: string) => { writeFileSync(join(dir, "results", name), JSON.stringify(m)); return join(dir, "results", name); };
    const r0 = manifest.runs[0] as { name: string; raw: string; cases: string; runAt: string };
    expect(() => loadOfficialRuns(write({ runs: [r0, { ...r0, name: "again" }] }, "m1.json"))).toThrow(/listed twice/);
    expect(() => loadOfficialRuns(write({ runs: [r0, { ...r0, raw: "run-1.raw.json", cases: "../cases-1.jsonl" }] }, "m2.json"))).toThrow(/duplicate run name/);
    expect(() => loadOfficialRuns(write({ runs: [] }, "m3.json"))).toThrow(/no runs listed/);
    writeFileSync(join(dir, "results", "dated.raw.json"), JSON.stringify({ runAt: "2026-01-01T00:00:00.000Z", rows: [] }));
    expect(() => loadOfficialRuns(write({ runs: [{ ...r0, name: "d", raw: "dated.raw.json" }] }, "m4.json"))).toThrow(/differs from the raw file/);
  });
});

// ---------- the combined.md format other tools parse ----------

describe("combined.md format", () => {
  const agg = aggregate(runsFrom(RUN_PLANS));
  const md = renderCombined(agg);
  const g = buildGenerated(agg);
  // Regexes copied from video/scripts/bench.mjs (readBench) and scripts/build-deck.py (read_results): keep them in sync.
  const head = /(\d+) synthetic cases: (\d+) scams, (\d+) genuine/.exec(md);
  const pick = (label: string) => new RegExp(`\\|\\s*${label}[^|]*\\|\\s*([\\d.]+)%`).exec(md)?.[1];

  it("has the Cases line in the exact format", () => {
    expect(head).not.toBeNull();
    expect([head![1], head![2], head![3]]).toEqual([g.cases, g.scams, g.genuine]);
  });
  it("has the headline table rows bench.mjs reads, equal to the generated values", () => {
    expect(pick("Accuracy")).toBe(g.accuracy);
    expect(pick("Scam recall")).toBe(g.recall);
    expect(pick("False-positive rate")).toBe(g.falsePositive);
    expect(/\|\s*Errors\s*\|\s*(\d+)/.exec(md)![1]).toBe(String(agg.overall.errors));
    expect(/\|\s*text\s*\|\s*([\d.]+) s/.exec(md)).not.toBeNull();
    expect(/Run: (\S+)/.exec(md)![1]).toBe("2026-10-17T00:00:00.000Z");
  });
  it("lists misses and false positives plainly", () => {
    expect(/Missed scams: (.+)/.exec(md)![1]).not.toBe("none");
    expect(/False positives: (.+)/.exec(md)![1]).not.toBe("none");
  });
  it("is readable by the deck builder's regexes (python), when python3 is available", () => {
    const script = `
import re, sys
text = sys.stdin.read()
pick = lambda label: re.search(rf"\\|\\s*{re.escape(label)}[^|]*\\|\\s*([^|]+?)\\s*\\|", text).group(1)
lat = {m.group(1): (m.group(2), m.group(3), m.group(4)) for m in re.finditer(r"\\|\\s*(text|image|audio)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*(\\d+)\\s*\\|", text)}
print("|".join([pick("Accuracy"), pick("Scam recall"), pick("False-positive rate"), pick("Scam type correct"), pick("Errors"), ",".join(re.search(r"(\\d+) synthetic cases: (\\d+) scams, (\\d+) genuine", text).groups()), re.search(r"False positives: (.+)", text).group(1).strip()[:5], re.search(r"Run: (\\d{4}-\\d{2}-\\d{2})", text).group(1), re.search(r"language: (\\w+)", text).group(1), ",".join(sorted(lat))]))
`;
    let out: string;
    try { out = execFileSync("python3", ["-I", "-c", script], { input: md, encoding: "utf8" }).trim(); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return; // no python here: the JS regexes above already cover it
      throw e;
    }
    const [acc, rec, fpr, , errors, cases, , date, lang, kinds] = out.split("|");
    expect(acc).toBe(`${g.accuracy}%`);
    expect(rec).toBe(`${g.recall}%`);
    expect(fpr).toBe(`${g.falsePositive}%`);
    expect(errors).toBe(String(agg.overall.errors));
    expect(cases).toBe(`${g.cases},${g.scams},${g.genuine}`);
    expect(date).toBe("2026-10-17");
    expect(lang).toBe("en");
    expect(kinds).toBe("audio,image,text");
  });
});

// ---------- the committed official data ----------

describe("committed official results", () => {
  const runs = loadOfficialRuns();
  const agg = aggregate(runs);
  const g = buildGenerated(agg);
  const readJson = () => JSON.parse(readFileSync(resolve(here, "../web/src/benchmark.generated.json"), "utf8")) as Record<string, string>;
  const md = readFileSync(resolve(here, "results/combined.md"), "utf8");

  it("lists the three official runs: v1 (50 cases), v2 (35), v3 (100)", () => {
    expect(runs.map((r) => [r.name, r.rows.length])).toEqual([["v1", 50], ["v2", 35], ["v3", 100]]);
  });
  it("every raw row joined to its case (ids unique across all three runs)", () => {
    expect(new Set(agg.rows.map((r) => r.id)).size).toBe(185);
    expect(agg.overall.total).toBe(185);
  });
  it("web/src/benchmark.generated.json equals the recomputed numbers exactly", () => {
    expect(readJson()).toEqual(g);
    expect(readFileSync(resolve(here, "../web/src/benchmark.generated.json"), "utf8")).toBe(renderGeneratedJson(g));
  });
  it("eval/results/combined.md is exactly what the aggregate renders (so its numbers match the generated JSON)", () => {
    expect(md).toBe(renderCombined(agg));
    expect(pick(md, "Accuracy")).toBe(readJson().accuracy);
    expect(pick(md, "Scam recall")).toBe(readJson().recall);
    expect(pick(md, "False-positive rate")).toBe(readJson().falsePositive);
    const head = /(\d+) synthetic cases: (\d+) scams, (\d+) genuine/.exec(md)!;
    expect([head[1], head[2], head[3]]).toEqual([readJson().cases, readJson().scams, readJson().genuine]);
  });
  it("the headline never overstates: it can only show 100 or 0 when there really is no miss or no false positive", () => {
    const c = agg.overall;
    expect(g.recall === "100").toBe(c.scamsFlagged === c.scams);
    expect(g.falsePositive === "0").toBe(c.legitFlagged === 0);
    expect(g.accuracy === "100").toBe(c.correct === c.scored);
  });
});

function pick(md: string, label: string): string {
  return new RegExp(`\\|\\s*${label}[^|]*\\|\\s*([\\d.]+)%`).exec(md)![1]!;
}
