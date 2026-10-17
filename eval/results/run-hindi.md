# Scam Shield evaluation

Run: 2026-10-17T13:28:42.406Z against https://project-91260b43-6705-4176-b71.web.app (language: hi, concurrency: 1). 50 synthetic cases: 26 scams, 24 genuine.
A message counts as flagged when the verdict is Scam or Suspicious.

| Metric | Result |
|---|---|
| Accuracy | 100.0% |
| Scam recall (scams flagged) | 100.0% |
| False-positive rate (genuine flagged) | 0.0% |
| Scam type correct (among flagged scams) | 100.0% |
| Errors | 0 |

| Input | p50 latency | p95 latency | Cases |
|---|---|---|---|
| text | 5.0 s | 8.6 s | 45 |
| image | 8.0 s | 9.7 s | 4 |
| audio | 11.6 s | 11.6 s | 1 |

Missed scams: none
False positives: none
Errors: none

Cases are in `eval/cases.jsonl`; raw results in `eval/results/`.
