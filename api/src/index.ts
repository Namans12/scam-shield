import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createApp, MAX_UPLOAD_BYTES } from "./app";
import type { AppDeps } from "./app";
import { FirestoreStore } from "./firestoreStore";
import { createGeminiModel } from "./gemini";
import { createLinkScanClient } from "./linkscanClient";

export const DEFAULT_LIMITS = { perUidPerDay: 30, globalPerDay: 3000, perIpPerMinute: 10 } as const;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

/** Wires the real Firebase / Gemini / linkscan dependencies. Nothing here touches the network until a request arrives. */
export function buildDeps(env: NodeJS.ProcessEnv = process.env): AppDeps {
  const project = required(env, "GOOGLE_CLOUD_PROJECT");
  const linkscanUrl = required(env, "LINKSCAN_URL");
  const bucketName = required(env, "STORAGE_BUCKET");
  if (getApps().length === 0) initializeApp({ projectId: project, storageBucket: bucketName });
  const bucket = () => getStorage().bucket(bucketName);

  return {
    store: new FirestoreStore(getFirestore()),
    model: createGeminiModel({
      project,
      location: env.GEMINI_LOCATION?.trim() || "global",
      model: env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
      combinedGrounding: (env.GEMINI_COMBINED_GROUNDING ?? "true").trim().toLowerCase() !== "false",
    }),
    scanner: createLinkScanClient(linkscanUrl),
    async verifyToken(idToken) {
      const decoded = await getAuth().verifyIdToken(idToken);
      return { uid: decoded.uid, provider: decoded.firebase.sign_in_provider };
    },
    async readUpload(path) {
      const file = bucket().file(path);
      const [meta] = await file.getMetadata();
      const size = Number(meta.size ?? 0);
      const mimeType = String(meta.contentType ?? "");
      const gcsUri = `gs://${bucketName}/${path}`;
      // Over the limit: report the size so the route rejects it, without downloading.
      if (!(size <= MAX_UPLOAD_BYTES)) return { bytes: Buffer.alloc(0), gcsUri, mimeType, size };
      const [bytes] = await file.download();
      return { bytes, gcsUri, mimeType, size };
    },
    async saveScreenshot(uid, checkId, jpeg) {
      const path = `screenshots/${uid}/${checkId}.jpg`;
      await bucket().file(path).save(jpeg, { contentType: "image/jpeg", resumable: false });
      return path;
    },
    async copyEvidence(storagePath, reportId) {
      await bucket().file(storagePath).copy(bucket().file(`reports/${reportId}/${basename(storagePath)}`));
    },
    now: () => new Date(),
    limits: { ...DEFAULT_LIMITS },
  };
}

export function buildApp(env: NodeJS.ProcessEnv = process.env) {
  return createApp(buildDeps(env));
}

// Start the HTTP server only when this file is the process entry point (not when imported).
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  const port = Number(process.env.PORT) || 8080;
  serve({ fetch: buildApp().fetch, port });
  console.log(`api listening on :${port}`);
}
