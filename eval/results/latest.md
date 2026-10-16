# Scam Shield evaluation

Run: 2026-10-16T14:41:33.743Z against https://project-91260b43-6705-4176-b71.web.app (language: en, concurrency: 1). 50 synthetic cases: 26 scams, 24 genuine.
A message counts as flagged when the verdict is Scam or Suspicious.

| Metric | Result |
|---|---|
| Accuracy | 98.0% |
| Scam recall (scams flagged) | 100.0% |
| False-positive rate (genuine flagged) | 4.2% |
| Scam type correct (among flagged scams) | 100.0% |
| Errors | 0 |

| Input | p50 latency | p95 latency | Cases |
|---|---|---|---|
| text | 4.4 s | 10.8 s | 45 |
| image | 9.9 s | 19.4 s | 4 |
| audio | 9.1 s | 9.1 s | 1 |

Missed scams: none
False positives: g23 (suspicious)
Errors: none

Cases are in `eval/cases.jsonl`; raw results in `eval/results/`.
