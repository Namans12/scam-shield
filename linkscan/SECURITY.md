# linkscan security notes

linkscan opens attacker-chosen URLs in headless Chromium. Assume the page is hostile.

## In-process controls
- http/https only, ports 80/443/default only; every resolved A/AAAA must be a global unicast address (IPv6 only inside 2000::/3).
- Every connection (document, each redirect hop, subresources, HTTPS CONNECT) goes through a per-scan validating proxy that pins DNS to the validated addresses. Chromium's loopback proxy bypass is disabled.
- WebRTC/WebTransport removed from pages, `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`, `--disable-quic`.
- One fresh browser context per scan: no cookies/storage carry over, downloads off, service workers blocked, permissions denied, popups/dialogs closed.
- Caps: 15 s hard deadline (all resources closed, slot released only after cleanup), 25 MB through the proxy, 150 requests, 8000 chars of text, `MAX_CONCURRENT_SCANS` (default 4; overflow = HTTP 503 + `Retry-After`), V8 heap 256 MB, `--jitless`, a renderer-process-limit hint of 2 (a soft limit: Chromium may still start more).
- `allowPrivateForTests` / `testAllowedOrigins` exist only for tests; `server.ts` never passes options (asserted by a test).

## Chromium sandbox
The sandbox is ON unless `LINKSCAN_NO_SANDBOX=1`. Cloud Run gen1 (gVisor) cannot create it, so the deploy script must set that variable explicitly on that runtime. With the sandbox off, the compensating controls below are mandatory.

## Deployment controls (compensating)
- Dedicated service account for linkscan with **zero roles** (no Firestore/Storage/Vertex, nothing).
- **No VPC connector and no Direct VPC egress**: the service must have no route to private networks.
- `--no-allow-unauthenticated`; `roles/run.invoker` granted only to the API's service account.
- Keep Playwright / base image current (bump `playwright` and the Dockerfile tag together; they must match exactly).
- One scan per context, 25 MB / 15 s caps as above; keep Cloud Run `--concurrency` equal to `MAX_CONCURRENT_SCANS`, memory >= 2 GiB.

## Known residuals
- Metadata server (169.254.169.254) is blocked by the guard and the proxy; the zero-role service account limits impact if that ever fails.
- Blob/worker contexts do not get the WebRTC init script; they cannot open sockets outside the proxy (no WebRTC in dedicated workers) and QUIC is disabled.
