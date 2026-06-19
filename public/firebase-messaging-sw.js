/* eslint-disable no-undef */
/* Firebase Messaging Service Worker
   — Must stay in public/ so it is served from the root path
   — Replace the config values with your actual Firebase project config
*/

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyAxznXrS8_O6p3ztEVCYrdQ-dL-gwmf2Pc",
  authDomain:        "schoolhomework-94da8.firebaseapp.com",
  projectId:         "schoolhomework-94da8",
  storageBucket:     "schoolhomework-94da8.firebasestorage.app",
  messagingSenderId: "26874566342",
  appId:             "1:26874566342:web:051991943dd65ec5d2a9c7",
});

const messaging = firebase.messaging();

/* Handle background notifications (when the app is closed or in background) */
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "VaanavilVidyalaya", {
    body:  body  || "You have a new notification",
    icon:  icon  || "/logo.png",
    badge: "/logo.png",
    data:  payload.data || {},
  });
});
