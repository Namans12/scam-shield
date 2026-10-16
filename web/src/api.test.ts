import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeResult } from "@/test/fixtures";

const getIdToken = vi.hoisted(() => vi.fn());
vi.mock("./firebase", () => ({
  ensureAnonymousUser: vi.fn(async () => ({ getIdToken })),
}));

import { ApiError, checkContent, errorMessageKey, reportCheck } from "./api";
import { ensureAnonymousUser } from "./firebase";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  getIdToken.mockReset();
  getIdToken.mockResolvedValue("tok-123");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("POSTs /api/check with a bearer token and returns the result", async () => {
    const result = makeResult();
    fetchMock.mockResolvedValue(jsonResponse(result));
    await expect(checkContent({ text: "hi", lang: "en" })).resolves.toEqual(result);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/check");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    expect(JSON.parse(init.body)).toEqual({ text: "hi", lang: "en" });
  });

  it("POSTs /api/report with the check id and place", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reportId: "r1", entityKeys: ["phone:+919876543210"] }));
    const out = await reportCheck("chk_1", { state: "Maharashtra", city: "Pune" });
    expect(out.reportId).toBe("r1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/report");
    expect(JSON.parse(init.body)).toEqual({ checkId: "chk_1", state: "Maharashtra", city: "Pune" });
  });

  it("turns an error body into an ApiError with the code and status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "daily_limit" }, 429));
    const err = await checkContent({ text: "hi", lang: "en" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "daily_limit", status: 429 });
    expect(errorMessageKey(err)).toBe("error.daily_limit");
  });

  it("falls back to unauthorized for a bare 401 and unknown for other non-JSON errors", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("nope", { status: 401 }));
    fetchMock.mockImplementationOnce(async () => new Response("nope", { status: 401 }));
    await expect(checkContent({ text: "hi", lang: "en" })).rejects.toMatchObject({ code: "unauthorized", status: 401 });
    fetchMock.mockImplementationOnce(async () => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(checkContent({ text: "hi", lang: "en" })).rejects.toMatchObject({ code: "unknown", status: 502 });
  });

  it("maps a 429 with a non-JSON body to rate_limited", async () => {
    fetchMock.mockResolvedValue(new Response("Too Many Requests", { status: 429 }));
    await expect(checkContent({ text: "hi", lang: "en" })).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("retries once with a refreshed token after a server 401", async () => {
    getIdToken.mockImplementation(async (force?: boolean) => (force ? "fresh-token" : "stale-token"));
    const result = makeResult();
    fetchMock.mockImplementationOnce(async () => jsonResponse({ error: "unauthorized" }, 401));
    fetchMock.mockImplementationOnce(async () => jsonResponse(result));

    await expect(checkContent({ text: "hi", lang: "en" })).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer stale-token");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh-token");
  });

  it("does not retry a second time when the refreshed token is also rejected", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: "unauthorized" }, 401));
    await expect(checkContent({ text: "hi", lang: "en" })).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry other errors", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: "daily_limit" }, 429));
    await expect(checkContent({ text: "hi", lang: "en" })).rejects.toMatchObject({ code: "daily_limit" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts after 70 seconds and reports a network error", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      );
      const pending = checkContent({ text: "hi", lang: "en" });
      const assertion = expect(pending).rejects.toMatchObject({ code: "network", status: 0 });
      await vi.advanceTimersByTimeAsync(69_000);
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(2_000);
      await assertion;
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a network failure as code network", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(checkContent({ text: "hi", lang: "en" })).rejects.toMatchObject({ code: "network", status: 0 });
  });

  it("reports a failed sign-in as unauthorized without calling the API", async () => {
    vi.mocked(ensureAnonymousUser).mockRejectedValueOnce(new Error("auth/network-request-failed"));
    await expect(checkContent({ text: "hi", lang: "en" })).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps unknown codes to the generic message", () => {
    expect(errorMessageKey(new ApiError("teapot", 418))).toBe("error.unknown");
    expect(errorMessageKey(new Error("boom"))).toBe("error.unknown");
  });
});
