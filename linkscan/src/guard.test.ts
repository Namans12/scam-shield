import { describe, expect, it } from "vitest";
import { assertPublicUrl, BlockedUrlError, isPublicAddress } from "./guard";

const NON_PUBLIC = [
  "10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.4", "192.168.1.1", "100.64.0.1", "0.0.0.0",
  "::1", "::", "fd00::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1",
  "224.0.0.1", "255.255.255.255", "64:ff9b::7f00:1", "not-an-ip", "",
];
const PUBLIC = ["8.8.8.8", "142.250.183.14", "2001:4860:4860::8888", "::ffff:8.8.8.8"];

describe("isPublicAddress", () => {
  it.each(NON_PUBLIC)("rejects %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
  it.each(PUBLIC)("accepts %s", (ip) => expect(isPublicAddress(ip)).toBe(true));
});

describe("assertPublicUrl", () => {
  const never = async () => { throw new Error("lookup must not be called"); };

  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toMatchObject({ reason: "bad_scheme" });
    await expect(assertPublicUrl("ftp://example.com/")).rejects.toMatchObject({ reason: "bad_scheme" });
    await expect(assertPublicUrl("javascript:alert(1)")).rejects.toMatchObject({ reason: "bad_scheme" });
    await expect(assertPublicUrl("not a url")).rejects.toMatchObject({ reason: "bad_scheme" });
  });

  it("rejects unusual ports", async () => {
    await expect(assertPublicUrl("http://example.com:8080/")).rejects.toMatchObject({ reason: "bad_port" });
    await expect(assertPublicUrl("https://example.com:22/")).rejects.toMatchObject({ reason: "bad_port" });
    await expect(assertPublicUrl("http://example.com:6379/", async () => ["8.8.8.8"])).rejects.toMatchObject({ reason: "bad_port" });
  });

  it("accepts default and explicit 80/443 ports", async () => {
    const ok = async () => ["8.8.8.8"];
    await expect(assertPublicUrl("http://example.com/", ok)).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl("https://example.com:443/x", ok)).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl("https://example.com:80/x", ok)).resolves.toBeInstanceOf(URL);
  });

  it("rejects hosts resolving to private addresses", async () => {
    await expect(assertPublicUrl("http://evil.test/", async () => ["10.1.2.3"])).rejects.toMatchObject({ reason: "private_address" });
    await expect(assertPublicUrl("http://metadata.google.internal/", async () => ["169.254.169.254"])).rejects.toMatchObject({ reason: "private_address" });
  });

  it("requires EVERY resolved record to be public", async () => {
    await expect(assertPublicUrl("http://mixed.test/", async () => ["8.8.8.8", "127.0.0.1"])).rejects.toMatchObject({ reason: "private_address" });
    await expect(assertPublicUrl("http://mixed.test/", async () => ["2001:4860:4860::8888", "fe80::1"])).rejects.toMatchObject({ reason: "private_address" });
  });

  it("reports unresolvable hosts", async () => {
    await expect(assertPublicUrl("http://nx.test/", async () => [])).rejects.toMatchObject({ reason: "unresolvable" });
    await expect(assertPublicUrl("http://nx.test/", async () => { throw new Error("ENOTFOUND"); })).rejects.toMatchObject({ reason: "unresolvable" });
  });

  it.each([
    "http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://017700000001/", "http://127.1/",
    "http://0/", "http://0.0.0.0/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/",
    "http://169.254.169.254/latest/meta-data/", "http://0xa9fea9fe/", "http://[fd00::1]/", "http://[fe80::1]/",
    "http://10.0.0.1/", "http://192.168.0.1/", "http://172.16.0.1/", "http://100.64.0.1/",
    "https://[::ffff:169.254.169.254]/", "http://0251.0376.0251.0376/",
  ])("blocks IP literal spelling %s without any DNS lookup", async (u) => {
    await expect(assertPublicUrl(u, never)).rejects.toMatchObject({ reason: "private_address" });
  });

  it.each([
    "http://localhost/", "http://LOCALHOST./", "http://foo.localhost/", "http://metadata.google.internal/",
    "http://printer.local/", "http://intranet/", "http://db.internal/",
  ])("blocks reserved hostname %s without any DNS lookup", async (u) => {
    await expect(assertPublicUrl(u, never)).rejects.toMatchObject({ reason: "private_address" });
  });

  it("accepts public IP literals without a lookup", async () => {
    await expect(assertPublicUrl("http://8.8.8.8/", never)).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl("https://[2001:4860:4860::8888]/", never)).resolves.toBeInstanceOf(URL);
  });

  it("throws BlockedUrlError instances", async () => {
    await expect(assertPublicUrl("file:///x")).rejects.toBeInstanceOf(BlockedUrlError);
  });
});
