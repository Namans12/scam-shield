# Scam Shield evaluation

Run: 2026-10-17T13:15:28.499Z against https://project-91260b43-6705-4176-b71.web.app (language: en, concurrency: 1). 50 synthetic cases: 26 scams, 24 genuine.
A message counts as flagged when the verdict is Scam or Suspicious.

| Metric | Result |
|---|---|
| Accuracy | 100.0% |
| Scam recall (scams flagged) | 100.0% |
| False-positive rate (genuine flagged) | 0.0% |
| Scam type correct (among flagged scams) | 96.2% |
| Errors | 0 |

| Input | p50 latency | p95 latency | Cases |
|---|---|---|---|
| text | 4.5 s | 12.9 s | 45 |
| image | 8.9 s | 9.5 s | 4 |
| audio | 14.2 s | 14.2 s | 1 |

Missed scams: none
False positives: none
Errors: none

Cases are in `eval/cases.jsonl`; raw results in `eval/results/`.
