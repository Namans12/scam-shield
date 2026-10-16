import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    expect(validateFile({ type: "audio/opus", size: 1 })).toEqual({ ok: true, kind: "audio" });
    expect(validateFile({ type: "audio/m4a", size: 1 })).toEqual({ ok: true, kind: "audio" });
  });

  it("does not depend on Object.hasOwn (older Android WebView)", () => {
    const original = Object.hasOwn;
    // @ts-expect-error simulating a runtime without Object.hasOwn
    delete Object.hasOwn;
    let png, odd;
    try {
      png = validateFile({ type: "image/png", size: 1 });
      odd = validateFile({ type: "constructor", size: 1 });
    } finally {
      Object.hasOwn = original;
    }
    expect(png).toEqual({ ok: true, kind: "image" });
    expect(odd).toEqual({ ok: false, code: "unsupported_type" });
  });
});

function fakeTask(events: Array<{ bytesTransferred: number; totalBytes: number }>, error?: { code: string }) {
  return {
    cancel: vi.fn(),
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
    const out = await uploadForCheck(file, { onProgress: (f) => progress.push(f) });

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

  it("uses the canonical type and extension for opus and m4a aliases", async () => {
    m.uploadBytesResumable.mockReturnValue(fakeTask([]));
    const opus = await uploadForCheck(new File(["x"], "a", { type: "audio/opus" }));
    expect(opus.mimeType).toBe("audio/ogg");
    expect(opus.storagePath).toMatch(/.ogg$/);
    const m4a = await uploadForCheck(new File(["x"], "a", { type: "audio/x-m4a" }));
    expect(m4a.mimeType).toBe("audio/mp4");
    expect(m4a.storagePath).toMatch(/.m4a$/);
    expect(m.uploadBytesResumable.mock.calls[0]![2]).toEqual({ contentType: "audio/ogg" });
    expect(m.uploadBytesResumable.mock.calls[1]![2]).toEqual({ contentType: "audio/mp4" });
  });

  it("falls back to a strict v4 uuid when crypto.randomUUID is missing", async () => {
    m.uploadBytesResumable.mockReturnValue(fakeTask([]));
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined });
    try {
      const out = await uploadForCheck(new File(["x"], "a.png", { type: "image/png" }));
      const id = out.storagePath.split("/")[2]!.replace(/.png$/, "");
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { configurable: true, value: original });
    }
  });

  describe("deadline and cancel", () => {
    // A task that stays pending until the test drives it.
    function pendingTask() {
      const task = {
        next: undefined as undefined | ((s: unknown) => void),
        cancel: vi.fn(),
        on(_e: string, next: (s: unknown) => void) {
          task.next = next;
        },
      };
      return task;
    }
    const png = () => new File(["x"], "a.png", { type: "image/png" });

    afterEach(() => vi.useRealTimers());

    it("cancels the task and fails with upload_failed when nothing moves for 60 seconds", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const task = pendingTask();
      m.uploadBytesResumable.mockReturnValue(task);
      const result = uploadForCheck(png()).catch((e: unknown) => e);
      await vi.waitFor(() => expect(m.uploadBytesResumable).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(59_000);
      expect(task.cancel).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(task.cancel).toHaveBeenCalledTimes(1);
      const err = await result;
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("upload_failed");
    });

    it("restarts the deadline whenever bytes move", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const task = pendingTask();
      m.uploadBytesResumable.mockReturnValue(task);
      const result = uploadForCheck(png()).catch((e: unknown) => e);
      await vi.waitFor(() => expect(m.uploadBytesResumable).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(50_000);
      task.next!({ bytesTransferred: 1, totalBytes: 10 });
      await vi.advanceTimersByTimeAsync(50_000);
      expect(task.cancel).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(11_000);
      expect(task.cancel).toHaveBeenCalledTimes(1);
      expect(((await result) as ApiError).code).toBe("upload_failed");
    });

    it("cancels the task and rejects with canceled when the signal aborts", async () => {
      const task = pendingTask();
      m.uploadBytesResumable.mockReturnValue(task);
      const controller = new AbortController();
      const result = uploadForCheck(png(), { signal: controller.signal }).catch((e: unknown) => e);
      await vi.waitFor(() => expect(m.uploadBytesResumable).toHaveBeenCalled());
      controller.abort();
      expect(task.cancel).toHaveBeenCalledTimes(1);
      const err = await result;
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("canceled");
    });

    it("does not start an upload when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const err = await uploadForCheck(png(), { signal: controller.signal }).catch((e: unknown) => e);
      expect((err as ApiError).code).toBe("canceled");
      expect(m.uploadBytesResumable).not.toHaveBeenCalled();
    });

    it("does not start an upload when aborted while signing in", async () => {
      const controller = new AbortController();
      m.ensureAnonymousUser.mockImplementation(async () => {
        controller.abort();
        return { uid: "user123" };
      });
      const err = await uploadForCheck(png(), { signal: controller.signal }).catch((e: unknown) => e);
      expect((err as ApiError).code).toBe("canceled");
      expect(m.uploadBytesResumable).not.toHaveBeenCalled();
    });

    it("stops the timer and listener once the upload finishes", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const controller = new AbortController();
      const task = { cancel: vi.fn(), on: (_e: string, _n: unknown, _f: unknown, done: () => void) => done() };
      m.uploadBytesResumable.mockReturnValue(task);
      await uploadForCheck(png(), { signal: controller.signal });
      await vi.advanceTimersByTimeAsync(120_000);
      controller.abort();
      expect(task.cancel).not.toHaveBeenCalled();
    });
  });
});
