// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// STEP 1: Go to https://console.firebase.google.com
// STEP 2: Click "Add project" → name it (e.g. "school-homework")
// STEP 3: Go to Project Settings → "Your apps" → Web app (</>)
// STEP 4: Copy your config values and paste them below
// STEP 5: In Firebase console, enable these:
//         - Authentication → Email/Password
//         - Firestore Database → Start in test mode
//         - Storage → Start in test mode
// ============================================================

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = initializeFirestore(app, {
  experimentalForceLongPolling: true,   // fixes real-time on Render.com / proxy hosts
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

/* Local development: `REACT_APP_USE_EMULATORS=true` in .env.local points the
   app at the Firebase emulators (see scripts/seed-emulator.js). */
if (process.env.REACT_APP_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

let messaging = null;
try { messaging = getMessaging(app); } catch (e) { console.warn("FCM not available:", e.message); }
export { messaging };

export default app;
