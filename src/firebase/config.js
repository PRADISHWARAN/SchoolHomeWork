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
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

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

let messaging = null;
try { messaging = getMessaging(app); } catch (e) { console.warn("FCM not available:", e.message); }
export { messaging };

export default app;
