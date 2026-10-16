// Firebase is loaded lazily: nothing here touches the SDK at import time, so the
// app (and the 1930 helpline) renders even if the config is missing or wrong, and
// the SDK is not downloaded until a check actually needs it. Auth only needs
// firebase/app + firebase/auth; Firestore and Storage are separate chunks that
// load when a later feature first calls getDb() / getStorageLazy().
import type { FirebaseApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

// Firebase web config is public by design (security comes from Auth + rules).
// Values are injected by Vite from web/.env.production or .env.local.
function firebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

/** Memoise an async factory, but forget a failure so the next call can retry. */
function once<T>(make: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = make().catch((err: unknown) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}

export const getFirebaseApp = once<FirebaseApp>(async () => {
  const { initializeApp } = await import("firebase/app");
  return initializeApp(firebaseConfig());
});

export const getAuthLazy = once<Auth>(async () => {
  const [app, { getAuth }] = await Promise.all([getFirebaseApp(), import("firebase/auth")]);
  return getAuth(app);
});

export const getDb = once<Firestore>(async () => {
  const [app, { getFirestore }] = await Promise.all([getFirebaseApp(), import("firebase/firestore")]);
  return getFirestore(app);
});

export const getStorageLazy = once<FirebaseStorage>(async () => {
  const [app, { getStorage }] = await Promise.all([getFirebaseApp(), import("firebase/storage")]);
  return getStorage(app);
});

/**
 * Makes sure there is a signed-in user, creating an anonymous one the first
 * time. Idempotent: concurrent and repeated calls share one promise, and a
 * returning visitor keeps the user restored from persistence instead of
 * getting a new anonymous identity on every page load. Rejects (without
 * breaking the app) when Firebase cannot start, e.g. a bad config.
 */
export const ensureAnonymousUser = once<User>(async () => {
  const auth = await getAuthLazy();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  const { signInAnonymously } = await import("firebase/auth");
  const cred = await signInAnonymously(auth);
  return cred.user;
});
