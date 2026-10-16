import { describe, expect, it, vi } from "vitest";
import { UploadNotFoundError } from "./app";
import { buildDeps, createStorageOps, parseBool, parseHops, parseThinking } from "./index";

describe("parseThinking", () => {
  it("defaults to LOW, accepts other levels, and lets 'default' leave the model setting", () => {
    expect(parseThinking(undefined)).toBe("LOW");
    expect(parseThinking("garbage")).toBe("LOW");
    expect(parseThinking(" high ")).toBe("HIGH");
    expect(parseThinking("minimal")).toBe("MINIMAL");
    expect(parseThinking("default")).toBeUndefined();
  });
});

describe("parseBool", () => {
  it("disables only on false/0/no/off (case-insensitive, trimmed); everything else uses the default or true", () => {
    for (const v of ["false", "FALSE", " False ", "0", "no", "No", "off", "OFF"]) expect(parseBool(v, true), v).toBe(false);
    for (const v of ["true", "1", "yes", "on", "anything"]) expect(parseBool(v, true), v).toBe(true);
    expect(parseBool(undefined, true)).toBe(true);
    expect(parseBool("", true)).toBe(true);
    expect(parseBool(undefined, false)).toBe(false);
  });
});

describe("parseHops", () => {
  it("defaults to 2 and accepts positive integers only", () => {
    expect(parseHops(undefined)).toBe(2);
    expect(parseHops("1")).toBe(1);
    expect(parseHops(" 3 ")).toBe(3);
    for (const v of ["0", "-1", "x", "1.5", ""]) expect(parseHops(v), v).toBe(2);
  });
});

describe("buildDeps", () => {
  it("requires the project, linkscan url and bucket", () => {
    expect(() => buildDeps({})).toThrow(/GOOGLE_CLOUD_PROJECT/);
  });
});

function fakeBucket(meta: { size?: string | number; contentType?: string } | Error) {
  const download = vi.fn(async () => [Buffer.from("bytes")] as [Buffer]);
  const save = vi.fn(async () => {});
  const copy = vi.fn(async () => {});
  const file = vi.fn((path: string) => ({
    path, download, save, copy,
    getMetadata: async () => { if (meta instanceof Error) throw meta; return [meta] as [typeof meta]; },
  }));
  return { bucket: { file }, download, save, copy, file };
}

describe("createStorageOps", () => {
  it("readUpload with metadataOnly never downloads and reports the stored contentType", async () => {
    const f = fakeBucket({ size: "1234", contentType: "image/png" });
    const ops = createStorageOps("b", () => f.bucket as never);
    const r = await ops.readUpload("uploads/u/a.png", { metadataOnly: true });
    expect(r).toMatchObject({ gcsUri: "gs://b/uploads/u/a.png", mimeType: "image/png", size: 1234 });
    expect(r.bytes.length).toBe(0);
    expect(f.download).not.toHaveBeenCalled();
  });

  it("downloads for a normal read, but not when the object is over the size limit", async () => {
    const f = fakeBucket({ size: 100, contentType: "audio/mpeg" });
    const r = await createStorageOps("b", () => f.bucket as never).readUpload("uploads/u/a.mp3");
    expect(r.bytes.toString()).toBe("bytes");
    const big = fakeBucket({ size: 999_999_999, contentType: "audio/mpeg" });
    const rb = await createStorageOps("b", () => big.bucket as never).readUpload("uploads/u/a.mp3");
    expect(rb.size).toBe(999_999_999);
    expect(rb.bytes.length).toBe(0);
    expect(big.download).not.toHaveBeenCalled();
  });

  it("returns an empty mimeType when the object has no contentType (the app then rejects it)", async () => {
    const f = fakeBucket({ size: 5 });
    expect((await createStorageOps("b", () => f.bucket as never).readUpload("uploads/u/x", { metadataOnly: true })).mimeType).toBe("");
  });

  it("maps a missing object to UploadNotFoundError and rethrows other errors", async () => {
    const nf = fakeBucket(Object.assign(new Error("No such object"), { code: 404 }));
    await expect(createStorageOps("b", () => nf.bucket as never).readUpload("uploads/u/x")).rejects.toBeInstanceOf(UploadNotFoundError);
    const boom = fakeBucket(Object.assign(new Error("denied"), { code: 403 }));
    const err = await createStorageOps("b", () => boom.bucket as never).readUpload("uploads/u/x").catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(UploadNotFoundError);
    expect(err).toBeInstanceOf(Error);
  });

  it("saves screenshots under screenshots/{uid}/{checkId}.jpg and copies evidence under reports/{id}/", async () => {
    const f = fakeBucket({});
    const ops = createStorageOps("b", () => f.bucket as never);
    expect(await ops.saveScreenshot("u1", "c1", Buffer.from("j"))).toBe("screenshots/u1/c1.jpg");
    expect(f.save).toHaveBeenCalledWith(Buffer.from("j"), { contentType: "image/jpeg", resumable: false });
    await ops.copyEvidence("uploads/u1/shot.png", "r1");
    expect(f.file).toHaveBeenCalledWith("reports/r1/shot.png");
    expect(f.copy).toHaveBeenCalled();
  });
});
