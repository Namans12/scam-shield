# Build with the REPO ROOT as context:
#   docker build -f linkscan/Dockerfile -t scam-shield-linkscan .
# The base image ships Chromium + system deps matching playwright 1.55.1 (pinned exactly in package.json).
FROM mcr.microsoft.com/playwright:v1.55.1-noble AS build
WORKDIR /app
# Reproducible runtime deps: root lockfile + the workspace manifests only (linkscan, and shared which it links to).
COPY package.json package-lock.json ./
COPY linkscan/package.json linkscan/package.json
COPY shared/package.json shared/package.json
RUN npm ci --omit=dev -w linkscan --ignore-scripts --no-audit --no-fund
COPY linkscan/src linkscan/src
# @scam-shield/shared is imported type-only (erased by esbuild), so its sources are not needed at runtime.
RUN npx --yes esbuild@0.28.2 linkscan/src/server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/server.js

FROM mcr.microsoft.com/playwright:v1.55.1-noble
WORKDIR /app
# NOTE: LINKSCAN_NO_SANDBOX is intentionally NOT set here. Chromium's sandbox stays ON by default.
# Cloud Run gen1 (gVisor) cannot create the user-namespace sandbox, so the deploy script passes
# --set-env-vars LINKSCAN_NO_SANDBOX=1 explicitly there; see linkscan/SECURITY.md for the compensating controls.
ENV NODE_ENV=production \
    PORT=8080
COPY --from=build --chown=pwuser:pwuser /app/node_modules ./node_modules
COPY --from=build --chown=pwuser:pwuser /app/dist ./dist
# "type": "module" is needed for the ESM bundle
COPY --from=build --chown=pwuser:pwuser /app/linkscan/package.json ./package.json
USER pwuser
EXPOSE 8080
CMD ["node","dist/server.js"]
