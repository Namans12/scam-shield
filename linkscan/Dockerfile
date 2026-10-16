# Build from the repo root:  docker build -f linkscan/Dockerfile -t scam-shield-linkscan .
# The base image ships Chromium + system deps matching playwright 1.55.0 (pinned exactly in package.json).
FROM mcr.microsoft.com/playwright:v1.55.0-noble AS build
WORKDIR /app
COPY linkscan/package.json ./package.json
# @scam-shield/shared is imported type-only (erased by esbuild), so it is not needed at runtime.
RUN npm pkg delete dependencies.@scam-shield/shared \
 && npm install --omit=dev --no-audit --no-fund
COPY linkscan/src ./src
RUN npx --yes esbuild@0.28.2 src/server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/server.js

FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    # Cloud Run (gVisor) cannot create Chromium's user-namespace sandbox; the container is the sandbox there.
    LINKSCAN_NO_SANDBOX=1
COPY --from=build --chown=pwuser:pwuser /app/package.json ./package.json
COPY --from=build --chown=pwuser:pwuser /app/node_modules ./node_modules
COPY --from=build --chown=pwuser:pwuser /app/dist ./dist
USER pwuser
EXPOSE 8080
CMD ["node","dist/server.js"]
