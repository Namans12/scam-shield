# Build with the REPO ROOT as context:
#   gcloud builds submit --config cloudbuild.yaml ...   (or: docker build -f api/Dockerfile -t scam-shield-api .)
FROM node:22-slim AS build
WORKDIR /app
# Reproducible runtime deps: root lockfile + the workspace manifests only (api, and shared which it links to).
# No --ignore-scripts needed: sharp 0.35 installs its prebuilt linux binary via optional platform packages
# (@img/sharp-linux-x64 + @img/sharp-libvips-linux-x64), which npm ci selects for this (glibc x64) image.
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY shared/package.json shared/package.json
RUN npm ci --omit=dev -w api --no-audit --no-fund
COPY api/src api/src
COPY shared/src shared/src
# @scam-shield/shared is a TS-source workspace package: alias it to its sources so it is INLINED into the bundle
# (every other bare import stays external and is resolved from node_modules at runtime).
RUN npx --yes esbuild@0.28.2 api/src/index.ts --bundle --platform=node --format=esm --packages=external \
      --alias:@scam-shield/shared=./shared/src/index.ts --outfile=dist/index.js \
 && ! grep -q '@scam-shield/shared' dist/index.js

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# "type": "module" is needed for the ESM bundle
COPY --from=build --chown=node:node /app/api/package.json ./package.json
USER node
EXPOSE 8080
CMD ["node","dist/index.js"]
