import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { app } from "./server";

const post = (body: unknown, raw = false) =>
  app.request("/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });

describe("POST /scan", () => {
  it("400 when url is missing, not a string, or body is not JSON", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ url: 5 })).status).toBe(400);
    expect((await post({ url: null })).status).toBe(400);
    expect((await post("not json", true)).status).toBe(400);
  });

  it("returns 200 with private_address for a loopback URL, ignoring test flags smuggled in the body", async () => {
    const res = await post({ url: "http://127.0.0.1:1/", allowPrivateForTests: true, testAllowedOrigins: ["http://127.0.0.1:1"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ requestedUrl: "http://127.0.0.1:1/", blockedReason: "private_address", redirects: [] });
  });

  it("returns 200 with bad_scheme for file:", async () => {
    const res = await post({ url: "file:///etc/passwd" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { blockedReason: string }).blockedReason).toBe("bad_scheme");
  });

  it("server entry point never references the test-only options or env switches", () => {
    const src = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/allowPrivate|testAllowedOrigins/);
    expect(src).not.toMatch(/process\.env\.(?!PORT\b)/);
  });
});

describe("GET /healthz", () => {
  it("200", async () => expect((await app.request("/healthz")).status).toBe(200));
});
