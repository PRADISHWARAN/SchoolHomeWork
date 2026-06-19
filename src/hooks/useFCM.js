import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { messaging } from "../firebase/config";
import { db } from "../firebase/config";
import toast from "react-hot-toast";

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

/**
 * Saves an FCM token to the logged-in user's Firestore document.
 */
async function saveToken(userId, token) {
  if (!userId || !token) return;
  try {
    await updateDoc(doc(db, "users", userId), { fcmToken: token });
    console.log("FCM token saved.");
  } catch (e) {
    console.warn("Could not save FCM token:", e.message);
  }
}

/**
 * useFCM
 *
 * Handles TWO scenarios:
 *  1. Web browser — requests permission, gets token via Firebase Web SDK
 *  2. Android WebView — receives token injected by native Android app via
 *     window.onAndroidFCMToken(token)
 */
export function useFCM(userId) {
  useEffect(() => {
    if (!userId) return;

    /* ── Scenario 1: Android WebView passes token via window function ── */
    window.onAndroidFCMToken = (token) => {
      console.log("Received FCM token from Android:", token);
      saveToken(userId, token);
    };

    /* ── Scenario 2: Regular browser — use Web Push ── */
    async function initWebFCM() {
      if (!messaging) return;
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) await saveToken(userId, token);
      } catch (e) {
        console.warn("Web FCM init:", e.message);
      }
    }

    initWebFCM();

    /* ── Foreground notifications (browser only) ── */
    let unsubscribe = () => {};
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || "VaanavilVidyalaya";
        const body  = payload.notification?.body  || "";
        toast(`🔔 ${title}${body ? " — " + body : ""}`, {
          duration: 6000,
          style: {
            background: "#4f46e5", color: "white",
            fontWeight: 600, borderRadius: 12,
          },
        });
      });
    }

    return () => {
      unsubscribe();
      delete window.onAndroidFCMToken;
    };
  }, [userId]);
}
