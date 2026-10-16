#!/usr/bin/env bash
# Scam Shield deploy pipeline (Git Bash / Linux). Usage: scripts/deploy.sh [api|linkscan|web|rules|all]
# Builds images with Cloud Build (no local Docker), deploys to Cloud Run / Firebase Hosting. Prints no secrets.
#   LINKSCAN_NO_SANDBOX=1   deploy linkscan with Chromium's sandbox off (only if the sandbox fails on the runtime)
#   GEMINI_SEARCH=true      deploy api with Google Search grounding on (default off: quota 429s and hangs)
#   DEBUG_XFF=1             deploy api with /api/health reporting the X-Forwarded-For entry count (diagnostic)
set -euo pipefail

PROJECT="${PROJECT:-project-91260b43-6705-4176-b71}"
REGION="${REGION:-asia-south1}"
REPO="scam-shield"
BUCKET="${STORAGE_BUCKET:-$PROJECT.firebasestorage.app}"
PROJECT_NUMBER="${PROJECT_NUMBER:-494852004380}"
API_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
LINKSCAN_SA_NAME="linkscan-sa"
LINKSCAN_SA="$LINKSCAN_SA_NAME@$PROJECT.iam.gserviceaccount.com"

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(pwd)"

if command -v gcloud >/dev/null 2>&1; then GCLOUD="$(command -v gcloud)"
else
  LAD="${LOCALAPPDATA:-}"; if [ -n "$LAD" ] && command -v cygpath >/dev/null 2>&1; then LAD="$(cygpath -u "$LAD")"; fi
  if [ -n "$LAD" ] && [ -e "$LAD/Google/Cloud SDK/google-cloud-sdk/bin/gcloud" ]; then GCLOUD="$LAD/Google/Cloud SDK/google-cloud-sdk/bin/gcloud"
  else echo "gcloud not found" >&2; exit 1; fi
fi
# Windows gcloud emits CRLF; strip it so captured values are clean.
gc() { "$GCLOUD" --project "$PROJECT" "$@" | tr -d '\r'; }

# Tag = git short sha; "-dirty" when the files that go into the images have uncommitted changes.
TAG="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain -- api linkscan shared package.json package-lock.json cloudbuild.yaml)" ]; then TAG="$TAG-dirty"; fi
REGISTRY="$REGION-docker.pkg.dev/$PROJECT/$REPO"

build_image() { # $1 = api|linkscan
  if [ "${SKIP_BUILD:-}" = "1" ]; then return 0; fi
  echo "== Cloud Build: $1:$TAG"
  gc builds submit . --config cloudbuild.yaml --substitutions="_SVC=$1,_TAG=$TAG,_REGION=$REGION,_REPO=$REPO" --quiet
}

service_url() { gc run services describe "$1" --region "$REGION" --format='value(status.url)'; }

deploy_rules() {
  echo "== Firestore rules + indexes, Storage rules"
  firebase deploy --only firestore:rules,firestore:indexes,storage --project "$PROJECT" --non-interactive
  echo "== Storage lifecycle (delete uploads/ after 7 days)"
  gc storage buckets update "gs://$BUCKET" --lifecycle-file=scripts/storage-lifecycle.json
}

deploy_linkscan() {
  build_image linkscan
  if ! gc iam service-accounts describe "$LINKSCAN_SA" >/dev/null 2>&1; then
    echo "== Creating service account $LINKSCAN_SA (no project roles)"
    gc iam service-accounts create "$LINKSCAN_SA_NAME" --display-name="Scam Shield linkscan (no roles)"
  fi
  local envflag=(--remove-env-vars=LINKSCAN_NO_SANDBOX)
  if [ "${LINKSCAN_NO_SANDBOX:-}" = "1" ]; then envflag=(--update-env-vars=LINKSCAN_NO_SANDBOX=1); fi
  echo "== Deploying scam-shield-linkscan"
  # Private, no VPC connector / egress settings, dedicated zero-role service account (see linkscan/SECURITY.md).
  gc run deploy scam-shield-linkscan --region "$REGION" --image "$REGISTRY/linkscan:$TAG" \
    --no-allow-unauthenticated --execution-environment gen2 \
    --memory 2Gi --cpu 2 --concurrency 4 --timeout 60 --min-instances 0 --max-instances 3 \
    --service-account "$LINKSCAN_SA" "${envflag[@]}" --quiet
  echo "== Granting run.invoker on the linkscan service to the API service account only"
  gc run services add-iam-policy-binding scam-shield-linkscan --region "$REGION" \
    --member="serviceAccount:$API_SA" --role=roles/run.invoker --quiet >/dev/null
  echo "linkscan: $(service_url scam-shield-linkscan)"
}

deploy_api() {
  build_image api
  local scan_url; scan_url="$(service_url scam-shield-linkscan)"
  [ -n "$scan_url" ] || { echo "linkscan is not deployed yet; run: scripts/deploy.sh linkscan" >&2; exit 1; }
  local env="GOOGLE_CLOUD_PROJECT=$PROJECT,GEMINI_MODEL=gemini-3.8-flash,GEMINI_LOCATION=global,GEMINI_COMBINED_GROUNDING=true,GEMINI_SEARCH=${GEMINI_SEARCH:-false},LINKSCAN_URL=$scan_url,STORAGE_BUCKET=$BUCKET,TRUSTED_PROXY_HOPS=${TRUSTED_PROXY_HOPS:-2}"
  if [ "${DEBUG_XFF:-}" = "1" ]; then env="$env,DEBUG_XFF=1"; fi
  echo "== Deploying scam-shield-api"
  gc run deploy scam-shield-api --region "$REGION" --image "$REGISTRY/api:$TAG" \
    --allow-unauthenticated --execution-environment gen2 \
    --memory 1Gi --cpu 1 --timeout 60 --concurrency 20 --min-instances 1 --max-instances 5 \
    --service-account "$API_SA" --set-env-vars "$env" --quiet
  echo "api: $(service_url scam-shield-api)"
}

deploy_web() {
  echo "== Building web"
  npm run build -w web
  [ -f web/dist/index.html ] || { echo "web/dist/index.html missing after build" >&2; exit 1; }
  echo "== Deploying Hosting"
  firebase deploy --only hosting --project "$PROJECT" --non-interactive
  echo "hosting: https://$PROJECT.web.app"
}

case "${1:-all}" in
  rules)    deploy_rules ;;
  linkscan) deploy_linkscan ;;
  api)      deploy_api ;;
  web)      deploy_web ;;
  all)
    deploy_rules
    # Build both images in parallel, then deploy linkscan before api (api needs LINKSCAN_URL).
    build_image linkscan & p1=$!
    build_image api & p2=$!
    wait "$p1"
    wait "$p2"
    SKIP_BUILD=1
    deploy_linkscan
    deploy_api
    deploy_web
    ;;
  *) echo "usage: $0 [api|linkscan|web|rules|all]" >&2; exit 2 ;;
esac
