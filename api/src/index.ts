import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createApp, DEFAULT_TRUSTED_PROXY_HOPS, MAX_UPLOAD_BYTES, UploadNotFoundError } from "./app";
import type { AppDeps } from "./app";
import { FirestoreStore } from "./firestoreStore";
import { createGeminiModel } from "./gemini";
import { createLinkScanClient } from "./linkscanClient";

export const DEFAULT_LIMITS = { perUidPerDay: 30, globalPerDay: 3000, perIpPerMinute: 10, perIpReportPerMinute: 60 } as const;
/** The link scan gets its own budget so scan (<= 12 s) plus Gemini (<= 30 s) fits inside the 45 s check limit. */
export const LINKSCAN_TIMEOUT_MS = 12_000;
export const SHUTDOWN_GRACE_MS = 8_000;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

/** Only "false"/"0"/"no"/"off" (any case) turn a flag off; unset or empty uses the default; anything else is on. */
export function parseBool(v: string | undefined, dflt: boolean): boolean {
  const t = v?.trim().toLowerCase();
  if (!t) return dflt;
  return !["false", "0", "no", "off"].includes(t);
}

export function parseHops(v: string | undefined): number {
  const t = v?.trim() ?? "";
  return /^[1-9]\d{0,2}$/.test(t) ? Number(t) : DEFAULT_TRUSTED_PROXY_HOPS;
}

interface BucketLike {
  file(path: string): {
    getMetadata(): Promise<[{ size?: string | number; contentType?: string }, ...unknown[]]>;
    download(): Promise<[Buffer, ...unknown[]]>;
    save(data: Buffer, opts: { contentType: string; resumable: boolean }): Promise<unknown>;
    copy(dest: unknown): Promise<unknown>;
  };
}

/** Cloud Storage operations behind AppDeps; `getBucket` is injectable so they can be tested without Storage. */
export function createStorageOps(bucketName: string, getBucket: () => BucketLike) {
  return {
    async readUpload(path: string, opts?: { metadataOnly?: boolean }) {
      const file = getBucket().file(path);
      let meta: { size?: string | number; contentType?: string };
      try {
        [meta] = await file.getMetadata();
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === 404) throw new UploadNotFoundError();
        throw e;
      }
      const size = Number(meta.size ?? 0);
      // Only the stored object's own contentType is trusted; empty makes the app answer unsupported_type.
      const mimeType = typeof meta.contentType === "string" ? meta.contentType : "";
      const gcsUri = `gs://${bucketName}/${path}`;
      // Metadata-only reads, and objects over the limit, are never downloaded: the route rejects them from `size`.
      if (opts?.metadataOnly || !(size <= MAX_UPLOAD_BYTES)) return { bytes: Buffer.alloc(0), gcsUri, mimeType, size };
      try {
        const [bytes] = await file.download();
        return { bytes, gcsUri, mimeType, size };
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === 404) throw new UploadNotFoundError();
        throw e;
      }
    },
    async saveScreenshot(uid: string, checkId: string, jpeg: Buffer) {
      const path = `screenshots/${uid}/${checkId}.jpg`;
      await getBucket().file(path).save(jpeg, { contentType: "image/jpeg", resumable: false });
      return path;
    },
    async copyEvidence(storagePath: string, reportId: string) {
      const b = getBucket();
      await b.file(storagePath).copy(b.file(`reports/${reportId}/${basename(storagePath)}`));
    },
  };
}

/** Wires the real Firebase / Gemini / linkscan dependencies. Nothing here touches the network until a request arrives. */
export function buildDeps(env: NodeJS.ProcessEnv = process.env): AppDeps {
  const project = required(env, "GOOGLE_CLOUD_PROJECT");
  const linkscanUrl = required(env, "LINKSCAN_URL");
  const bucketName = required(env, "STORAGE_BUCKET");
  if (getApps().length === 0) initializeApp({ projectId: project, storageBucket: bucketName });
  const storage = createStorageOps(bucketName, () => getStorage().bucket(bucketName) as unknown as BucketLike);

  return {
    store: new FirestoreStore(getFirestore()),
    model: createGeminiModel({
      project,
      location: env.GEMINI_LOCATION?.trim() || "global",
      model: env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
      combinedGrounding: parseBool(env.GEMINI_COMBINED_GROUNDING, true),
    }),
    scanner: createLinkScanClient(linkscanUrl, LINKSCAN_TIMEOUT_MS),
    async verifyToken(idToken) {
      const decoded = await getAuth().verifyIdToken(idToken);
      return { uid: decoded.uid, provider: decoded.firebase.sign_in_provider };
    },
    ...storage,
    now: () => new Date(),
    limits: { ...DEFAULT_LIMITS },
    trustedProxyHops: parseHops(env.TRUSTED_PROXY_HOPS),
  };
}

export function buildApp(env: NodeJS.ProcessEnv = process.env) {
  return createApp(buildDeps(env));
}

// Start the HTTP server only when this file is the process entry point (not when imported).
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  const port = Number(process.env.PORT) || 8080;
  const server = serve({ fetch: buildApp().fetch, port });
  console.log(`api listening on :${port}`);

  // Cloud Run sends SIGTERM before stopping an instance: stop accepting, let in-flight requests finish (max 8 s).
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
