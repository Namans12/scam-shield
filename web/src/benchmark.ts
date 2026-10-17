// The proof numbers shown on the landing page. They must match the latest run in eval/results/latest.md
// (web/src/benchmark.test.ts fails if they drift apart: update both together after a new benchmark run).
export const BENCHMARK = { accuracy: "100", recall: "100", falsePositive: "0" } as const;
