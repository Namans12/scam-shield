#!/usr/bin/env bash
# Smoke test: scripts/smoke.sh <base-url>   (Hosting URL, or the api *.run.app URL for a direct API check)
# Prints "SMOKE OK" only when every check passes. Tokens are never printed.
# SMOKE_API_ONLY=1 skips the "GET /" check (the bare run.app API has no landing page).
set -uo pipefail
BASE="${1:?usage: smoke.sh <base-url>}"; BASE="${BASE%/}"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# The web API key is public client config (web/.env.production), not a secret.
KEY="$(grep -E '^VITE_FIREBASE_API_KEY=' web/.env.production | head -1 | cut -d= -f2- | tr -d '\r\n ')"
[ -n "$KEY" ] || { echo "no VITE_FIREBASE_API_KEY in web/.env.production" >&2; exit 1; }

FAIL=0
ok()  { echo "PASS  $*"; }
bad() { echo "FAIL  $*"; FAIL=1; }
http() { node scripts/http.mjs "$@"; }                       # prints "<status> <seconds>" then the body
status() { printf '%s' "$1" | head -1 | cut -d' ' -f1; }
secs()   { printf '%s' "$1" | head -1 | cut -d' ' -f2; }
body()   { printf '%s' "$1" | tail -n +2; }
jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s)[process.argv[1]];process.stdout.write(v===undefined?"":String(v))}catch{}})' "$1"; }

# 1. Landing page
r="$(http GET "$BASE/")"; code="$(status "$r")"
if [ "$code" = 200 ]; then ok "GET / -> 200"; elif [ "${SMOKE_API_ONLY:-}" = 1 ]; then echo "SKIP  GET / ($code; SMOKE_API_ONLY=1)"; else bad "GET / -> $code"; fi

# 2. Health
r="$(http GET "$BASE/api/health")"; h="$(body "$r")"
if [ "$(status "$r")" = 200 ] && [ "$h" = '{"ok":true}' ]; then ok "GET /api/health -> $h"; else bad "GET /api/health -> $(status "$r") $h"; fi

# 3. Anonymous ID token
r="$(http POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$KEY" --json '{"returnSecureToken":true}')"
TOKEN="$(body "$r" | jget idToken)"
if [ -n "$TOKEN" ]; then ok "anonymous sign-in (token minted)"; else bad "anonymous sign-in failed ($(status "$r"))"; echo "SMOKE FAILED"; exit 1; fi

check() { # $1 = text -> prints "<http_code> <verdict> <seconds>"
  local payload r
  payload="$(node -e 'process.stdout.write(JSON.stringify({text:process.argv[1],lang:"en"}))' "$1")"
  r="$(http POST "$BASE/api/check" --bearer "$TOKEN" --json "$payload")"
  echo "$(status "$r") $(body "$r" | jget verdict) $(secs "$r")"
}

# 4. KYC scam text -> scam | suspicious within 45 s
read -r c v t <<<"$(check 'Dear customer, your SBI YONO account will be blocked today due to pending KYC update. Click http://sbi-kyc-update.top/verify and enter your PAN, Aadhaar and OTP immediately or your account will be suspended.')"
if [ "$c" = 200 ] && { [ "$v" = scam ] || [ "$v" = suspicious ]; } && [ "$t" -le 45 ]; then ok "KYC scam text -> $v in ${t}s"; else bad "KYC scam text -> http=$c verdict=$v in ${t}s"; fi

# 5. Genuine debit alert -> record the verdict (informational: any non-error answer passes)
read -r c v t <<<"$(check 'HDFC Bank: Rs 1,250.00 debited from A/c XX4521 on 14-10-26 at SWIGGY. Avl Bal Rs 18,430.55. If not you, call 18002586161.')"
if [ "$c" = 200 ] && [ -n "$v" ]; then echo "INFO  genuine debit alert -> verdict=$v in ${t}s"; else bad "genuine debit alert -> http=$c verdict=$v"; fi

# 6. No / bad token -> 401. (The check endpoint is POST-only: an unauthenticated GET is just a 404, so POST proves auth.)
r="$(http POST "$BASE/api/check" --json '{"text":"hi","lang":"en"}')"; code="$(status "$r")"
if [ "$code" = 401 ]; then ok "POST /api/check without token -> 401"; else bad "POST /api/check without token -> $code (want 401)"; fi
r="$(http POST "$BASE/api/check" --bearer not-a-real-token --json '{"text":"hi","lang":"en"}')"; code="$(status "$r")"
if [ "$code" = 401 ]; then ok "POST /api/check with a bad token -> 401"; else bad "POST /api/check with a bad token -> $code (want 401)"; fi

if [ "$FAIL" = 0 ]; then echo "SMOKE OK"; else echo "SMOKE FAILED"; exit 1; fi
