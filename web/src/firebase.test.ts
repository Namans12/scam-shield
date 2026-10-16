import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fakeAuth = {
    currentUser: null as null | { uid: string },
    authStateReady: vi.fn(async () => {}),
  };
  return { fakeAuth, signInAnonymously: vi.fn() };
});

vi.mock("firebase/auth", () => ({
  getAuth: () => mocks.fakeAuth,
  signInAnonymously: mocks.signInAnonymously,
}));

describe("ensureAnonymousUser", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.fakeAuth.currentUser = null;
    mocks.fakeAuth.authStateReady.mockClear();
    mocks.signInAnonymously.mockReset();
  });

  it("signs in anonymously once, even when called concurrently and repeatedly", async () => {
    mocks.signInAnonymously.mockImplementation(async () => ({ user: { uid: "anon-1" } }));
    const { ensureAnonymousUser } = await import("./firebase");

    const [a, b] = await Promise.all([ensureAnonymousUser(), ensureAnonymousUser()]);
    const c = await ensureAnonymousUser();

    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(c).toBe(a);
  });

  it("reuses the user restored from persistence instead of signing in again", async () => {
    mocks.fakeAuth.currentUser = { uid: "returning" };
    const { ensureAnonymousUser } = await import("./firebase");
    await expect(ensureAnonymousUser()).resolves.toEqual({ uid: "returning" });
    expect(mocks.fakeAuth.authStateReady).toHaveBeenCalled();
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it("lets the next call retry after a failure", async () => {
    mocks.signInAnonymously
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ user: { uid: "anon-2" } });
    const { ensureAnonymousUser } = await import("./firebase");

    await expect(ensureAnonymousUser()).rejects.toThrow("offline");
    await expect(ensureAnonymousUser()).resolves.toEqual({ uid: "anon-2" });
    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(2);
  });
});
