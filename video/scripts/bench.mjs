// Reads the benchmark numbers from eval/results/latest.md at build time (never hard-coded).
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LATEST = resolve(ROOT, "../eval/results/latest.md");

export function readBench() {
  const md = readFileSync(LATEST, "utf8");
  const head = md.match(/(\d+) synthetic cases: (\d+) scams, (\d+) genuine/);
  if (!head) throw new Error("eval/results/latest.md: could not find the '<n> synthetic cases: <x> scams, <y> genuine' line");
  const pct = (label) => {
    const m = md.match(new RegExp(`\\|\\s*${label}[^|]*\\|\\s*([\\d.]+)%`));
    if (!m) throw new Error(`eval/results/latest.md: no row for ${label}`);
    return parseFloat(m[1]);
  };
  const errors = md.match(/\|\s*Errors\s*\|\s*(\d+)/);
  const run = md.match(/Run: (\S+)/);
  const p50 = md.match(/\|\s*text\s*\|\s*([\d.]+) s/);
  return {
    cases: +head[1],
    scams: +head[2],
    genuine: +head[3],
    accuracy: pct("Accuracy"),
    recall: pct("Scam recall"),
    falsePositive: pct("False-positive rate"),
    scamType: pct("Scam type correct"),
    errors: errors ? +errors[1] : 0,
    textP50: p50 ? parseFloat(p50[1]) : null,
    run: run ? run[1] : null,
  };
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function words(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n === 100) return "one hundred";
  throw new Error("words(): unsupported " + n);
}
export function pctWords(p) {
  const whole = Math.floor(p);
  const frac = Math.round((p - whole) * 10);
  return frac ? `${words(whole)} point ${ONES[frac]}` : words(whole);
}

/** Values for the {{tokens}} used in narration.json. */
export function narrationTokens(b = readBench()) {
  const flaggedAll = b.recall === 100;
  const fpNone = b.falsePositive === 0;
  return {
    n: String(b.cases),
    p50: String(b.textP50),
    p50_words: String(b.textP50).split(".").map((x, i) => (i ? "point " + [...x].map((c) => ONES[+c]).join(" ") : words(+x))).join(" "),
    n_words: words(b.cases),
    recall_spoken: flaggedAll ? `all ${words(b.scams)} scams` : `${pctWords(b.recall)} percent of the ${words(b.scams)} scams`,
    recall_caption: flaggedAll ? `all ${b.scams} scams` : `${b.recall}% of ${b.scams} scams`,
    fpr_spoken: fpNone ? `none of the ${words(b.genuine)} genuine messages` : `${pctWords(b.falsePositive)} percent of the ${words(b.genuine)} genuine messages`,
    fpr_caption: fpNone ? `none of ${b.genuine} genuine messages` : `${b.falsePositive}% of ${b.genuine} genuine messages`,
  };
}
if (process.argv[1].endsWith("bench.mjs")) console.log(readBench(), narrationTokens());
