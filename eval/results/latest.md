# Scam Shield evaluation

Run: 2026-10-16T14:25:27.681Z against https://project-91260b43-6705-4176-b71.web.app (language: en, concurrency: 1). 50 synthetic cases: 26 scams, 24 genuine.
A message counts as flagged when the verdict is Scam or Suspicious.

| Metric | Result |
|---|---|
| Accuracy | 96.0% |
| Scam recall (scams flagged) | 100.0% |
| False-positive rate (genuine flagged) | 8.3% |
| Scam type correct (among flagged scams) | 100.0% |
| Errors | 0 |

| Input | p50 latency | p95 latency | Cases |
|---|---|---|---|
| text | 4.9 s | 18.9 s | 45 |
| image | 8.5 s | 20.4 s | 4 |
| audio | 11.4 s | 11.4 s | 1 |

Missed scams: none
False positives: g15 (suspicious), g23 (scam)
Errors: none

Cases are in `eval/cases.jsonl`; raw results in `eval/results/`.
