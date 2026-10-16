import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fakeAuth = {
    currentUser: null as null | { uid: string },
    authStateReady: vi.fn(async () => {}),
  };
  return {
    fakeAuth,
    signInAnonymously: vi.fn(),
    linkWithPopup: vi.fn(),
    signInWithPopup: vi.fn(),
    initializeApp: vi.fn(() => ({ name: "app" })),
    getAuth: vi.fn(() => fakeAuth),
    getFirestore: vi.fn(() => ({ kind: "db" })),
    getStorage: vi.fn(() => ({ kind: "storage" })),
  };
});

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/auth", () => ({
  getAuth: mocks.getAuth,
  signInAnonymously: mocks.signInAnonymously,
  linkWithPopup: mocks.linkWithPopup,
  signInWithPopup: mocks.signInWithPopup,
  GoogleAuthProvider: class GoogleAuthProvider {},
}));
vi.mock("firebase/firestore", () => ({ getFirestore: mocks.getFirestore }));
vi.mock("firebase/storage", () => ({ getStorage: mocks.getStorage }));

describe("firebase (lazy)", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.fakeAuth.currentUser = null;
    mocks.fakeAuth.authStateReady.mockClear();
    mocks.signInAnonymously.mockReset();
    mocks.initializeApp.mockClear();
    mocks.getAuth.mockClear();
    mocks.getAuth.mockImplementation(() => mocks.fakeAuth);
    mocks.getFirestore.mockClear();
    mocks.getStorage.mockClear();
  });

  it("does not initialise Firebase just by importing the module", async () => {
    await import("./firebase");
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it("does not throw at import when the config is bad, and rejects only when used", async () => {
    mocks.getAuth.mockImplementation(() => {
      throw new Error("auth/invalid-api-key");
    });
    const { ensureAnonymousUser } = await import("./firebase");
    await expect(ensureAnonymousUser()).rejects.toThrow("auth/invalid-api-key");
  });

  it("initialises app and auth on first use but never Firestore or Storage", async () => {
    mocks.signInAnonymously.mockResolvedValue({ user: { uid: "anon-1" } });
    const { ensureAnonymousUser } = await import("./firebase");
    await ensureAnonymousUser();
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(mocks.getAuth).toHaveBeenCalledTimes(1);
    expect(mocks.getFirestore).not.toHaveBeenCalled();
    expect(mocks.getStorage).not.toHaveBeenCalled();
  });

  it("creates Firestore and Storage only when asked, once each, on the same app", async () => {
    const { getDb, getStorageLazy, getFirebaseApp } = await import("./firebase");
    const [db1, db2] = await Promise.all([getDb(), getDb()]);
    const st = await getStorageLazy();
    expect(db1).toBe(db2);
    expect(st).toMatchObject({ kind: "storage" });
    // A stalled upload or request gives up in well under the SDK default of 10 minutes.
    expect(st).toMatchObject({ maxUploadRetryTime: 45_000, maxOperationRetryTime: 45_000 });
    expect(mocks.getFirestore).toHaveBeenCalledTimes(1);
    expect(mocks.getStorage).toHaveBeenCalledTimes(1);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(await getFirebaseApp()).toEqual({ name: "app" });
  });
});

describe("ensureAnonymousUser", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.fakeAuth.currentUser = null;
    mocks.fakeAuth.authStateReady.mockClear();
    mocks.signInAnonymously.mockReset();
    mocks.getAuth.mockImplementation(() => mocks.fakeAuth);
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

describe("signInWithGoogle", () => {
  const getIdToken = vi.fn(async () => "token");
  beforeEach(() => {
    vi.resetModules();
    getIdToken.mockClear();
    mocks.fakeAuth.currentUser = { uid: "anon-1" };
    mocks.linkWithPopup.mockReset();
    mocks.signInWithPopup.mockReset();
    mocks.getAuth.mockImplementation(() => mocks.fakeAuth);
  });

  it("links the anonymous user to Google when possible", async () => {
    const linked = { uid: "anon-1", getIdToken };
    mocks.linkWithPopup.mockResolvedValue({ user: linked });
    const { signInWithGoogle } = await import("./firebase");
    await expect(signInWithGoogle()).resolves.toBe(linked);
    expect(mocks.linkWithPopup).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithPopup).not.toHaveBeenCalled();
    // A fresh ID token, so the API sees the google.com provider.
    expect(getIdToken).toHaveBeenCalledWith(true);
  });

  it("falls back to signInWithPopup on auth/credential-already-in-use", async () => {
    const existing = { uid: "google-9", getIdToken };
    mocks.linkWithPopup.mockRejectedValue(Object.assign(new Error("in use"), { code: "auth/credential-already-in-use" }));
    mocks.signInWithPopup.mockResolvedValue({ user: existing });
    const { signInWithGoogle } = await import("./firebase");
    await expect(signInWithGoogle()).resolves.toBe(existing);
    expect(mocks.signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it("does not hide other errors such as a closed popup", async () => {
    mocks.linkWithPopup.mockRejectedValue(Object.assign(new Error("closed"), { code: "auth/popup-closed-by-user" }));
    const { signInWithGoogle } = await import("./firebase");
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: "auth/popup-closed-by-user" });
    expect(mocks.signInWithPopup).not.toHaveBeenCalled();
  });

  it("recognises a Google user", async () => {
    const { isGoogleUser } = await import("./firebase");
    expect(isGoogleUser({ providerData: [{ providerId: "google.com" }] as never })).toBe(true);
    expect(isGoogleUser({ providerData: [] })).toBe(false);
    expect(isGoogleUser(null)).toBe(false);
  });
});
