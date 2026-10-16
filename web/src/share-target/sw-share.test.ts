// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleShare, parseSharedForm, takeSharedPayload } from "./sw-share";

function form(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** A tiny in-memory CacheStorage, enough for put/match/delete. */
function fakeCaches(): CacheStorage {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      put: async (k: string, r: Response) => void m.set(k, r),
      match: async (k: string) => m.get(k)?.clone(),
      delete: async (k: string) => m.delete(k),
    } as unknown as Cache;
  };
  return { open } as unknown as CacheStorage;
}

describe("parseSharedForm", () => {
  it("pulls the link out of text when url is empty (WhatsApp puts links in text)", () => {
    expect(parseSharedForm(form({ text: "Update KYC https://bnb-kyc-update.web.app", url: "" }))).toEqual({
      text: "Update KYC https://bnb-kyc-update.web.app",
      url: "https://bnb-kyc-update.web.app",
    });
  });

  it("keeps an explicit url and drops trailing punctuation from an extracted one", () => {
    expect(parseSharedForm(form({ url: "https://a.test/x", text: "see this" })).url).toBe("https://a.test/x");
    expect(parseSharedForm(form({ text: "Click https://a.test/x)." })).url).toBe("https://a.test/x");
  });

  it("joins title and text, without repeating the title", () => {
    expect(parseSharedForm(form({ title: "Offer", text: "Win big" })).text).toBe("Offer\nWin big");
    expect(parseSharedForm(form({ title: "Offer", text: "Offer: win big" })).text).toBe("Offer: win big");
  });

  it("returns the shared file", () => {
    const file = new File(["x"], "shot.png", { type: "image/png" });
    expect(parseSharedForm(form({ media: file })).file?.name).toBe("shot.png");
    expect(parseSharedForm(form({})).file).toBeUndefined();
  });
});

describe("share handoff", () => {
  it("parks the share, redirects with 303, and hands it over once", async () => {
    const caches = fakeCaches();
    const fd = form({ text: "Hello https://a.test/", media: new File(["png-bytes"], "s.png", { type: "image/png" }) });
    const res = await handleShare(new Request("https://app.test/share-target", { method: "POST", body: fd }), caches);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.test/?shared=1");

    const first = await takeSharedPayload(caches);
    expect(first).toMatchObject({ text: "Hello https://a.test/", url: "https://a.test/" });
    expect(first?.file?.type).toBe("image/png");
    expect(await first!.file!.text()).toBe("png-bytes");
    expect(await takeSharedPayload(caches)).toBeNull();
  });

  it("still redirects when the body is not a form", async () => {
    const res = await handleShare(new Request("https://app.test/share-target", { method: "POST", body: "nope" }), fakeCaches());
    expect(res.status).toBe(303);
  });
});
