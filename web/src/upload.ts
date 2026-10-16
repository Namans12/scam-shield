// Screenshot, QR and voice-note uploads. Files go straight from the browser to
// Firebase Storage under uploads/{uid}/, and the API is then given only the
// storage path. firebase/storage is loaded with a dynamic import when an upload
// starts, so it stays out of the first page load.
import { ApiError } from "./api";
import { ensureAnonymousUser, getStorageLazy } from "./firebase";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export type FileKind = "image" | "audio";

/** The types the Storage rules and the API accept, with the extension used in the storage path. */
const TYPES: Record<string, { kind: FileKind; ext: string }> = {
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/wav": { kind: "audio", ext: "wav" },
  "audio/webm": { kind: "audio", ext: "webm" },
};

/** Names some browsers and phones use for the same formats. */
const ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "audio/mp3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/opus": "audio/ogg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-aac": "audio/aac",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
};

/** "Audio/WebM;codecs=opus" -> "audio/webm". Returns null for a type we do not accept. */
function canonicalType(type: string): string | null {
  const base = (type.split(";")[0] ?? "").trim().toLowerCase();
  const canonical = ALIASES[base] ?? base;
  return Object.prototype.hasOwnProperty.call(TYPES, canonical) ? canonical : null;
}

export type ValidateResult = { ok: true; kind: FileKind } | { ok: false; code: "unsupported_type" | "file_too_large" };

export function validateFile(f: { type: string; size: number }): ValidateResult {
  const type = canonicalType(f.type);
  if (!type || f.size <= 0) return { ok: false, code: "unsupported_type" };
  const { kind } = TYPES[type]!;
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (f.size > max) return { ok: false, code: "file_too_large" };
  return { ok: true, kind };
}

/** Maps a Firebase Storage error to the friendly codes the UI has messages for. */
function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
  switch (code) {
    case "storage/unauthorized":
    case "storage/unauthenticated":
      return new ApiError("unauthorized", 403);
    case "storage/retry-limit-exceeded":
      return new ApiError("network", 0);
    case "storage/canceled":
    case "storage/quota-exceeded":
      return new ApiError("upload_failed", 0);
    default:
      // The SDK failing to load (offline) shows up as a TypeError, not a Storage error.
      return err instanceof TypeError ? new ApiError("network", 0) : new ApiError("upload_failed", 0);
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** An upload that moves no bytes for this long is cancelled (each bit of progress restarts the clock). */
export const UPLOAD_STALL_MS = 60_000;

export interface UploadOptions {
  /** Called with a fraction between 0 and 1. */
  onProgress?: (fraction: number) => void;
  /** Aborting cancels the upload; the promise then rejects with ApiError code "canceled". */
  signal?: AbortSignal;
}

/**
 * Uploads a validated file to uploads/{uid}/{uuid}.{ext}. The content type sent
 * to Storage comes from our own validation, never from the file name. Rejects with
 * an ApiError the UI can show: "upload_failed" if the upload stalls for
 * UPLOAD_STALL_MS or fails, "canceled" if the signal aborts it.
 */
export async function uploadForCheck(
  file: File,
  { onProgress, signal }: UploadOptions = {},
): Promise<{ storagePath: string; mimeType: string }> {
  const checked = validateFile(file);
  if (!checked.ok) throw new ApiError(checked.code, 400);
  const mimeType = canonicalType(file.type)!;
  const canceled = () => new ApiError("canceled", 0);

  try {
    if (signal?.aborted) throw canceled();
    let user;
    try {
      user = await ensureAnonymousUser();
    } catch {
      throw new ApiError("unauthorized", 401);
    }
    const [storage, { ref, uploadBytesResumable }] = await Promise.all([getStorageLazy(), import("firebase/storage")]);
    if (signal?.aborted) throw canceled();

    const storagePath = `uploads/${user.uid}/${newId()}.${TYPES[mimeType]!.ext}`;
    const task = uploadBytesResumable(ref(storage, storagePath), file, { contentType: mimeType });
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      const stop = (err: unknown) => {
        finish();
        task.cancel();
        reject(err);
      };
      const onAbort = () => stop(canceled());
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => stop(new ApiError("upload_failed", 0)), UPLOAD_STALL_MS);
      };
      signal?.addEventListener("abort", onAbort);
      arm();
      task.on(
        "state_changed",
        (snap) => {
          arm();
          onProgress?.(snap.totalBytes > 0 ? snap.bytesTransferred / snap.totalBytes : 0);
        },
        (err) => {
          finish();
          reject(err);
        },
        () => {
          finish();
          resolve();
        },
      );
    });
    return { storagePath, mimeType };
  } catch (err) {
    throw toApiError(err);
  }
}
