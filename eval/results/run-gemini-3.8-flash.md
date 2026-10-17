# Scam Shield evaluation

Run: 2026-10-16T15:38:03.761Z against https://project-91260b43-6705-4176-b71.web.app (language: en, concurrency: 1). 50 synthetic cases: 26 scams, 24 genuine.
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
| text | 4.5 s | 8.6 s | 45 |
| image | 7.4 s | 33.8 s | 4 |
| audio | 11.8 s | 11.8 s | 1 |

Missed scams: none
False positives: g23 (suspicious)
Errors: none

Cases are in `eval/cases.jsonl`; raw results in `eval/results/`.
