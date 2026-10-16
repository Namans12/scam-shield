import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Firebase web config is public by design (security comes from Auth + rules).
// Values are injected by Vite from web/.env.production or .env.local.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

let pending: Promise<User> | null = null;

/**
 * Makes sure there is a signed-in user, creating an anonymous one the first
 * time. Idempotent: concurrent and repeated calls share one promise, and a
 * returning visitor keeps the user restored from persistence instead of
 * getting a new anonymous identity on every page load.
 */
export function ensureAnonymousUser(): Promise<User> {
  if (!pending) {
    pending = (async () => {
      await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser;
      const cred = await signInAnonymously(auth);
      return cred.user;
    })().catch((err: unknown) => {
      // Let the next call retry (e.g. the network was down the first time).
      pending = null;
      throw err;
    });
  }
  return pending;
}
