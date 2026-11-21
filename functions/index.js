const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule }                           = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError }                   = require("firebase-functions/v2/https");
const admin                 = require("firebase-admin");

admin.initializeApp();

const db        = admin.firestore();
const messaging = admin.messaging();

const STUDENT_DOMAIN = "vaanavilvidyalaya.com";

/* ─── Helper: students of a class (full docs) ──────────────── */
async function studentsOf(classId) {
  const snap = await db.collection("users")
    .where("role",    "==", "student")
    .where("classId", "==", classId)
    .get();
  return snap.docs;
}

/* ─── Helper: FCM tokens for all students in a class ──────── */
async function getStudentTokens(classId) {
  return (await studentsOf(classId)).map(d => d.data().fcmToken).filter(Boolean);
}

/* ─── Helper: FCM tokens for ALL users in the school ──────── */
async function getAllTokens() {
  const snap = await db.collection("users").get();
  return snap.docs.map(d => d.data().fcmToken).filter(Boolean);
}

/* ─── Helper: FCM tokens for the class teacher(s) + "All classes" teachers ── */
async function getTeacherTokens(classId) {
  const snap = await db.collection("users")
    .where("role",    "==", "teacher")
    .where("classId", "in", [classId, "ALL"])
    .get();
  return snap.docs.map(d => d.data().fcmToken).filter(Boolean);
}

/* ─── Helper: FCM token for a specific student by uid ───────── */
async function getTokenByUid(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  const token   = userDoc.data()?.fcmToken;
  return token ? [token] : [];
}

/* ─── Helper: send to a list of tokens (chunks of 500) ──────── */
async function sendToTokens(tokens, title, body) {
  // Brothers, sisters and twins often share one phone → the same device token
  // is saved on several accounts. Send each message only once per device.
  tokens = [...new Set(tokens.filter(Boolean))];
  if (!tokens.length) return;
  // FCM multicast limit is 500 per call
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }
  for (const chunk of chunks) {
    try {
      await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        android:  { notification: { color: "#6366f1", sound: "default", priority: "high" } },
        webpush:  { notification: { icon: "/logo.png", badge: "/logo.png" } },
        apns:     { payload: { aps: { sound: "default" } } },
      });
      console.log(`Sent "${title}" to ${chunk.length} devices`);
    } catch (e) {
      console.error("sendToTokens error:", e);
    }
  }
}

/* ─── Helper: a student only does homework posted after they joined the class ── */
function studentShouldDo(student, hw) {
  const joined  = student.classJoinedAt?.toMillis?.();
  const created = hw.createdAt?.toMillis?.();
  return !(joined && created && created < joined);
}

/* ─── Helper: tokens of students who still owe this homework ── */
async function pendingStudentTokens(hwId, hw) {
  const subSnap = await db.collection("submissions").where("homeworkId", "==", hwId).get();
  const submittedIds = new Set(subSnap.docs.map(d => d.data().studentId));
  return (await studentsOf(hw.classId))
    .filter(d => !submittedIds.has(d.id) && studentShouldDo(d.data(), hw))
    .map(d => d.data().fcmToken)
    .filter(Boolean);
}

/* ─── Helpers: school time zone (IST, UTC+05:30, no DST) ─────
   Cloud Functions run in UTC, but teachers enter dueDate/dueTime
   in Indian time, so all date math must be done in IST.        */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// Date → "YYYY-MM-DD" as seen on a clock in India
function istDateStr(date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" + "HH:MM" (IST) → exact Date instant
function istDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00+05:30`);
}

/* ─── Helper: format "HH:MM" → "2:30 PM" ─────────────────── */
function fmtTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function shorten(text, max) {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/* ─── Helpers: delete uploaded files when their record is deleted ── */
function storagePathFromUrl(url) {
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media&token=…
  const m = /\/o\/([^?#]+)/.exec(url || "");
  return m ? decodeURIComponent(m[1]) : null;
}

async function deleteFiles(urls) {
  const bucket = admin.storage().bucket();
  for (const path of new Set(urls.map(storagePathFromUrl).filter(Boolean))) {
    try {
      await bucket.file(path).delete();
      console.log("Deleted file", path);
    } catch (e) {
      if (e.code !== 404) console.warn("Could not delete file", path, e.message);
    }
  }
}

/* ─── Helper: twins (same phone AND date of birth) list each other,
       so the dashboard can show "Switch to …" ─────────────────────── */
async function relinkTwins(phone, dob) {
  if (!phone || !dob) return;
  const snap  = await db.collection("users").where("phone", "==", phone).get();
  const group = snap.docs.filter(d => d.data().role === "student" && d.data().dob === dob);
  await Promise.all(group.map(d => d.ref.update({
    twins: group.filter(o => o.id !== d.id).map(o => ({ name: o.data().name, email: o.data().email })),
  })));
}

async function requireAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  const caller = await db.collection("users").doc(request.auth.uid).get();
  if (caller.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can do this.");
  }
}

/* ═══════════════════════════════════════════════════════════
   TRIGGER 1 — Teacher posts homework → students in class notified
═══════════════════════════════════════════════════════════ */
exports.onHomeworkCreated = onDocumentCreated("homework/{hwId}", async (event) => {
  const hw = event.data?.data();
  if (!hw?.classId) return;

  // Mark this doc so the 3-hour reminder knows it hasn't been sent yet
  try {
    await event.data.ref.update({ reminderSent3h: false });
  } catch (e) {
    if (e.code === 5) return;   // NOT_FOUND: the homework was deleted straight away
    throw e;
  }

  const tokens  = await getStudentTokens(hw.classId);
  const subject = hw.subject || hw.gamePlatform || "Homework";
  const due     = hw.dueDate
    ? `Due: ${hw.dueDate}${hw.dueTime ? " at " + fmtTime(hw.dueTime) : ""}`
    : "";

  await sendToTokens(
    tokens,
    `📚 New Homework — ${hw.title}`,
    `${subject} · Class ${hw.classId}${due ? "  |  " + due : ""}`
  );
});

/* ═══════════════════════════════════════════════════════════
   TRIGGER 2 — Admin posts announcement → EVERYONE notified
═══════════════════════════════════════════════════════════ */
exports.onAnnouncementCreated = onDocumentCreated("announcements/{id}", async (event) => {
  const text = event.data?.data()?.text;
  if (!text) return;

  const tokens = await getAllTokens();
  await sendToTokens(tokens, "📢 School Announcement", shorten(text, 120));
});

/* ═══════════════════════════════════════════════════════════
   TRIGGER 3 — Every day 8 AM IST: remind students whose
   homework is due today (no specific time set) and haven't submitted
═══════════════════════════════════════════════════════════ */
exports.dailyDueReminder = onSchedule(
  { schedule: "every day 08:00", timeZone: "Asia/Kolkata" },
  async () => {
    const today = istDateStr(new Date());

    const hwSnap = await db.collection("homework")
      .where("dueDate", "==", today)
      .get();

    if (hwSnap.empty) { console.log("No homework due today."); return; }

    for (const hwDoc of hwSnap.docs) {
      const hw = hwDoc.data();
      // Skip homework that has a specific dueTime — the 3-hour reminder handles those
      if (hw.dueTime) continue;

      await sendToTokens(
        await pendingStudentTokens(hwDoc.id, hw),
        `⏰ Due Today: ${hw.title}`,
        `${hw.subject || "Homework"} is due today — submit before it's too late!`
      );
    }
  }
);

/* ═══════════════════════════════════════════════════════════
   TRIGGER 4 — Every 30 min: send a "3 hours left" alert to
   students who haven't submitted homework with a specific dueTime
═══════════════════════════════════════════════════════════ */
exports.threeHourDueReminder = onSchedule(
  { schedule: "every 30 minutes", timeZone: "Asia/Kolkata" },
  async () => {
    const now     = new Date();
    const in3h    = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // Collect all IST date strings that fall in the now → now+3h window
    const dateSet = new Set();
    dateSet.add(istDateStr(now));
    dateSet.add(istDateStr(in3h));

    for (const dateStr of dateSet) {
      const hwSnap = await db.collection("homework")
        .where("dueDate",         "==", dateStr)
        .where("reminderSent3h",  "==", false)
        .get();

      for (const hwDoc of hwSnap.docs) {
        const hw = hwDoc.data();
        if (!hw.dueTime) continue; // no time set — handled by dailyDueReminder

        // Build the exact due datetime (dueTime is IST, server is UTC)
        const dueDateTime   = istDateTime(hw.dueDate, hw.dueTime);
        const hoursUntilDue = (dueDateTime - now) / (1000 * 60 * 60);

        // Only fire when due is within the next 0–3 hours
        if (hoursUntilDue < 0 || hoursUntilDue > 3) continue;

        await sendToTokens(
          await pendingStudentTokens(hwDoc.id, hw),
          `⚠️ Less Than 3 Hours Left! — ${hw.title}`,
          `${hw.subject || "Homework"} is due at ${fmtTime(hw.dueTime)}. Submit now before the deadline!`
        );

        // Mark reminder as sent so we don't fire again
        await hwDoc.ref.update({ reminderSent3h: true });
      }
    }
  }
);

/* ═══════════════════════════════════════════════════════════
   TRIGGER 5 — Student posts a doubt → class teacher(s) notified
═══════════════════════════════════════════════════════════ */
exports.onDoubtCreated = onDocumentCreated("doubts/{doubtId}", async (event) => {
  const doubt = event.data?.data();
  if (!doubt?.classId) return;

  const tokens = await getTeacherTokens(doubt.classId);
  const isVoice = !!doubt.audioUrl;
  await sendToTokens(
    tokens,
    `${isVoice ? "🎙️ New Voice Doubt" : "❓ New Doubt"} — ${doubt.studentName}`,
    isVoice
      ? `${doubt.studentName} (Class ${doubt.classId}) posted a voice doubt. Tap to listen & reply.`
      : `${doubt.studentName} (Class ${doubt.classId}): ${shorten(doubt.text || "", 90)}`
  );
});

/* ═══════════════════════════════════════════════════════════
   TRIGGER 6 — Teacher replies to a doubt → student notified
═══════════════════════════════════════════════════════════ */
exports.onDoubtReplied = onDocumentUpdated("doubts/{doubtId}", async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Fire only when a reply is freshly added (was null, now has value)
  if (before.reply || !after.reply) return;

  const tokens = await getTokenByUid(after.studentId);
  await sendToTokens(
    tokens,
    `✅ Your Doubt Was Answered!`,
    after.reply.audioUrl
      ? `${after.reply.teacherName} replied to your doubt. Tap to listen!`
      : `${after.reply.teacherName}: ${shorten(after.reply.text || "", 100)}`
  );
});

/* ═══════════════════════════════════════════════════════════
   TRIGGER 7 — Teacher posts class announcement → students notified
═══════════════════════════════════════════════════════════ */
exports.onClassAnnouncementCreated = onDocumentCreated("classAnnouncements/{id}", async (event) => {
  const ann = event.data?.data();
  if (!ann?.classId) return;

  const tokens = await getStudentTokens(ann.classId);
  const body   = ann.text
    ? shorten(ann.text, 110)
    : `${ann.teacherName} sent a voice announcement. Tap to listen!`;

  await sendToTokens(tokens, `📢 Announcement from ${ann.teacherName}`, body);
});

/* ═══════════════════════════════════════════════════════════
   CLEAN-UP — when a record is deleted, delete its uploaded files
   (and, for homework / students, the records that belong to them)
═══════════════════════════════════════════════════════════ */
exports.onSubmissionDeleted = onDocumentDeleted("submissions/{id}", async (event) => {
  const s = event.data?.data();
  if (!s) return;
  await deleteFiles([...(s.files || []).map(f => f.url), s.fileUrl]);
});

exports.onHomeworkDeleted = onDocumentDeleted("homework/{id}", async (event) => {
  const hw = event.data?.data();
  if (!hw) return;
  await deleteFiles([hw.fileUrl]);
  // The app already deletes the submissions; this also covers deletes made elsewhere
  const subs = await db.collection("submissions").where("homeworkId", "==", event.params.id).get();
  await Promise.all(subs.docs.map(d => d.ref.delete()));   // each one removes its own files
});

exports.onClassAnnouncementDeleted = onDocumentDeleted("classAnnouncements/{id}", async (event) => {
  const ann = event.data?.data();
  if (ann) await deleteFiles([ann.audioUrl]);
});

exports.onDoubtDeleted = onDocumentDeleted("doubts/{id}", async (event) => {
  const d = event.data?.data();
  if (d) await deleteFiles([d.audioUrl, d.reply?.audioUrl]);
});

exports.onUserDeleted = onDocumentDeleted("users/{uid}", async (event) => {
  const u = event.data?.data();
  if (!u) return;
  const uid = event.params.uid;
  await deleteFiles([u.photoURL]);
  if (u.role !== "student") return;
  // A removed student's homework and doubts go too (each removes its own files)
  const [subs, doubts] = await Promise.all([
    db.collection("submissions").where("studentId", "==", uid).get(),
    db.collection("doubts").where("studentId", "==", uid).get(),
  ]);
  await Promise.all([...subs.docs, ...doubts.docs].map(d => d.ref.delete()));
  await relinkTwins(u.phone, u.dob);   // the remaining twin loses the "Switch" button
});

/* ═══════════════════════════════════════════════════════════
   CALLABLE — Admin deletes a user: removes BOTH the login
   (Firebase Auth) and the Firestore profile, so a deleted
   user can no longer sign in. onUserDeleted cleans up the rest.
═══════════════════════════════════════════════════════════ */
exports.deleteUserAccount = onCall(async (request) => {
  await requireAdmin(request);

  const uid = request.data?.uid;
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "A user id is required.");
  }
  if (uid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "You cannot delete your own admin account.");
  }

  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    // Profile without a login (e.g. created by hand) — still remove the profile.
    if (e.code !== "auth/user-not-found") throw new HttpsError("internal", e.message);
  }
  await db.collection("users").doc(uid).delete();

  console.log(`Admin ${request.auth.uid} deleted user ${uid}`);
  return { ok: true };
});

/* ═══════════════════════════════════════════════════════════
   CALLABLE — Admin corrects a student's phone number and/or date
   of birth. These are the login (phone + DOB), so the Auth account
   is updated too — the student keeps all their homework history.
═══════════════════════════════════════════════════════════ */
function isRealDob(dob) {
  if (!/^\d{8}$/.test(dob)) return false;
  const d = +dob.slice(0, 2), m = +dob.slice(2, 4), y = +dob.slice(4);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
      && y >= 1990 && date <= new Date();
}

exports.updateStudentLogin = onCall(async (request) => {
  await requireAdmin(request);

  const { uid, phone, dob } = request.data || {};
  if (typeof uid !== "string" || !uid) throw new HttpsError("invalid-argument", "A user id is required.");
  if (!/^[6-9]\d{9}$/.test(phone || "")) throw new HttpsError("invalid-argument", "Phone number must be 10 digits.");
  if (!isRealDob(dob || "")) throw new HttpsError("invalid-argument", "Date of birth must be a real date (DDMMYYYY).");

  const ref  = db.collection("users").doc(uid);
  const snap = await ref.get();
  const user = snap.data();
  if (!user || user.role !== "student") throw new HttpsError("not-found", "Student not found.");

  // Same login scheme as the app: phone@ → phone_DOB@ (brother/sister) → phone_DOB_2@ (twins)
  const candidates = [
    `${phone}@${STUDENT_DOMAIN}`,
    `${phone}_${dob}@${STUDENT_DOMAIN}`,
    `${phone}_${dob}_2@${STUDENT_DOMAIN}`,
    `${phone}_${dob}_3@${STUDENT_DOMAIN}`,
  ];
  let email = null;
  for (const candidate of candidates) {
    if (candidate === user.email) { email = candidate; break; }
    try {
      await admin.auth().getUserByEmail(candidate);   // taken by another child
    } catch (e) {
      if (e.code === "auth/user-not-found") { email = candidate; break; }
      throw new HttpsError("internal", e.message);
    }
  }
  if (!email) throw new HttpsError("already-exists", "Too many children already use this phone and date of birth.");

  await admin.auth().updateUser(uid, { email, password: dob });
  await ref.update({ phone, dob, email });

  // Twin links for the old and the new phone + DOB
  await relinkTwins(user.phone, user.dob);
  await relinkTwins(phone, dob);

  console.log(`Admin ${request.auth.uid} changed login of ${uid}`);
  return { email };
});
