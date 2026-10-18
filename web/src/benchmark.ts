// The proof numbers shown on the landing page. They are NOT typed by hand: benchmark.generated.json is written by
// `npx tsx eval/aggregate.ts` from the official runs listed in eval/results/official.json (combined over all of them),
// and web/src/benchmark.test.ts recomputes the numbers from the raw results at test time, so any drift fails CI.
// To update after a new benchmark run: add the run to eval/results/official.json, then run `npx tsx eval/aggregate.ts`.
import generated from "./benchmark.generated.json";

export const BENCHMARK: {
  readonly accuracy: string;
  readonly recall: string;
  readonly falsePositive: string;
  readonly cases: string;
  readonly scams: string;
  readonly genuine: string;
  readonly ambiguous: string;
} = {
  accuracy: generated.accuracy,
  recall: generated.recall,
  falsePositive: generated.falsePositive,
  cases: generated.cases,
  scams: generated.scams,
  genuine: generated.genuine,
  ambiguous: generated.ambiguous,
};
