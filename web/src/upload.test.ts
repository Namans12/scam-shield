import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ensureAnonymousUser: vi.fn(),
  getStorageLazy: vi.fn(),
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));

vi.mock("./firebase", () => ({
  ensureAnonymousUser: m.ensureAnonymousUser,
  getStorageLazy: m.getStorageLazy,
}));
vi.mock("firebase/storage", () => ({ ref: m.ref, uploadBytesResumable: m.uploadBytesResumable }));

import { ApiError } from "./api";
import { uploadForCheck, validateFile } from "./upload";

const MB = 1024 * 1024;

describe("validateFile", () => {
  it("accepts png, jpeg and webp images up to 10 MB", () => {
    expect(validateFile({ type: "image/png", size: 1 })).toEqual({ ok: true, kind: "image" });
    expect(validateFile({ type: "image/jpeg", size: 10 * MB })).toEqual({ ok: true, kind: "image" });
    expect(validateFile({ type: "image/webp", size: 5 * MB })).toEqual({ ok: true, kind: "image" });
  });

  it("accepts the supported audio types up to 15 MB", () => {
    expect(validateFile({ type: "audio/ogg", size: 15 * MB })).toEqual({ ok: true, kind: "audio" });
    for (const type of ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/webm"]) {
      expect(validateFile({ type, size: 1000 })).toEqual({ ok: true, kind: "audio" });
    }
  });

  it("rejects an image over 10 MB and audio over 15 MB", () => {
    expect(validateFile({ type: "image/png", size: 10 * MB + 1 })).toEqual({ ok: false, code: "file_too_large" });
    expect(validateFile({ type: "audio/mpeg", size: 15 * MB + 1 })).toEqual({ ok: false, code: "file_too_large" });
    // An audio file may be bigger than an image may be.
    expect(validateFile({ type: "audio/mpeg", size: 12 * MB })).toEqual({ ok: true, kind: "audio" });
  });

  it("rejects other types, including PDFs, GIFs and an empty type", () => {
    expect(validateFile({ type: "application/pdf", size: 1 })).toEqual({ ok: false, code: "unsupported_type" });
    expect(validateFile({ type: "image/gif", size: 1 })).toEqual({ ok: false, code: "unsupported_type" });
    expect(validateFile({ type: "", size: 1 })).toEqual({ ok: false, code: "unsupported_type" });
    expect(validateFile({ type: "image/svg+xml", size: 1 })).toEqual({ ok: false, code: "unsupported_type" });
  });

  it("rejects an empty file", () => {
    expect(validateFile({ type: "image/png", size: 0 })).toEqual({ ok: false, code: "unsupported_type" });
  });

  it("copes with parameters and common aliases in the type", () => {
    expect(validateFile({ type: "audio/webm;codecs=opus", size: 1 })).toEqual({ ok: true, kind: "audio" });
    expect(validateFile({ type: "IMAGE/PNG", size: 1 })).toEqual({ ok: true, kind: "image" });
    expect(validateFile({ type: "audio/x-m4a", size: 1 })).toEqual({ ok: true, kind: "audio" });
    expect(validateFile({ type: "audio/mp3", size: 1 })).toEqual({ ok: true, kind: "audio" });
  });
});

function fakeTask(events: Array<{ bytesTransferred: number; totalBytes: number }>, error?: { code: string }) {
  return {
    on(_evt: string, next: (s: unknown) => void, fail: (e: unknown) => void, done: () => void) {
      for (const e of events) next(e);
      if (error) fail(error);
      else done();
    },
  };
}

beforeEach(() => {
  m.ensureAnonymousUser.mockReset().mockResolvedValue({ uid: "user123" });
  m.getStorageLazy.mockReset().mockResolvedValue({ name: "storage" });
  m.ref.mockReset().mockImplementation((_s: unknown, path: string) => ({ fullPath: path }));
  m.uploadBytesResumable.mockReset();
});

describe("uploadForCheck", () => {
  it("uploads to uploads/{uid}/{uuid}.{ext} with the validated content type and reports progress", async () => {
    m.uploadBytesResumable.mockReturnValue(
      fakeTask([
        { bytesTransferred: 0, totalBytes: 10 },
        { bytesTransferred: 5, totalBytes: 10 },
        { bytesTransferred: 10, totalBytes: 10 },
      ]),
    );
    // The name lies about the type: the metadata must come from the validated type.
    const file = new File(["abc"], "evil.exe", { type: "image/png" });
    const progress: number[] = [];
    const out = await uploadForCheck(file, (f) => progress.push(f));

    expect(out.mimeType).toBe("image/png");
    expect(out.storagePath).toMatch(/^uploads\/user123\/[0-9a-f-]{36}\.png$/);
    expect(m.ref).toHaveBeenCalledWith({ name: "storage" }, out.storagePath);
    const [refArg, fileArg, metadata] = m.uploadBytesResumable.mock.calls[0]!;
    expect(refArg).toEqual({ fullPath: out.storagePath });
    expect(fileArg).toBe(file);
    expect(metadata).toEqual({ contentType: "image/png" });
    expect(progress).toEqual([0, 0.5, 1]);
  });

  it("uses a canonical audio type and extension", async () => {
    m.uploadBytesResumable.mockReturnValue(fakeTask([]));
    const out = await uploadForCheck(new File(["x"], "note", { type: "audio/webm;codecs=opus" }));
    expect(out.mimeType).toBe("audio/webm");
    expect(out.storagePath).toMatch(/\.webm$/);
    expect(m.uploadBytesResumable.mock.calls[0]![2]).toEqual({ contentType: "audio/webm" });
  });

  it("maps storage/unauthorized to the friendly unauthorized code", async () => {
    m.uploadBytesResumable.mockReturnValue(fakeTask([], { code: "storage/unauthorized" }));
    const err = await uploadForCheck(new File(["x"], "a.png", { type: "image/png" })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("unauthorized");
  });

  it("maps cancelled and unknown storage errors to upload_failed, and retry limits to network", async () => {
    const run = async (code: string) => {
      m.uploadBytesResumable.mockReturnValue(fakeTask([], { code }));
      const err = await uploadForCheck(new File(["x"], "a.png", { type: "image/png" })).catch((e: unknown) => e);
      return (err as ApiError).code;
    };
    expect(await run("storage/canceled")).toBe("upload_failed");
    expect(await run("storage/unknown")).toBe("upload_failed");
    expect(await run("storage/retry-limit-exceeded")).toBe("network");
  });

  it("rejects an unsupported or oversized file before touching Firebase", async () => {
    const pdf = await uploadForCheck(new File(["x"], "a.pdf", { type: "application/pdf" })).catch((e: unknown) => e);
    expect((pdf as ApiError).code).toBe("unsupported_type");
    expect(m.ensureAnonymousUser).not.toHaveBeenCalled();
  });

  it("reports unauthorized when there is no signed-in user", async () => {
    m.ensureAnonymousUser.mockRejectedValue(new Error("auth/network"));
    const err = await uploadForCheck(new File(["x"], "a.png", { type: "image/png" })).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("unauthorized");
  });

  it("reports a network problem when the storage SDK cannot even load", async () => {
    m.getStorageLazy.mockRejectedValue(new TypeError("Failed to fetch dynamically imported module"));
    const err = await uploadForCheck(new File(["x"], "a.png", { type: "image/png" })).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("network");
  });
});
