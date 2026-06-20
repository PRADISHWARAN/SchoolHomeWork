const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule }                           = require("firebase-functions/v2/scheduler");
const admin                 = require("firebase-admin");

admin.initializeApp();

const db        = admin.firestore();
const messaging = admin.messaging();

/* ─── Helper: FCM tokens for all students in a class ──────── */
async function getStudentTokens(classId) {
  const snap = await db.collection("users")
    .where("role",    "==", "student")
    .where("classId", "==", classId)
    .get();
  return snap.docs.map(d => d.data().fcmToken).filter(Boolean);
}

/* ─── Helper: FCM tokens for ALL users in the school ──────── */
async function getAllTokens() {
  const snap = await db.collection("users").get();
  return snap.docs.map(d => d.data().fcmToken).filter(Boolean);
}

/* ─── Helper: FCM tokens for teacher(s) of a class ─────────── */
async function getTeacherTokens(classId) {
  const snap = await db.collection("users")
    .where("role",    "==", "teacher")
    .where("classId", "==", classId)
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

/* ─── Helper: format "HH:MM" → "2:30 PM" ─────────────────── */
function fmtTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* ═══════════════════════════════════════════════════════════
   TRIGGER 1 — Teacher posts homework → students in class notified
═══════════════════════════════════════════════════════════ */
exports.onHomeworkCreated = onDocumentCreated("homework/{hwId}", async (event) => {
  const hw = event.data?.data();
  if (!hw?.classId) return;

  // Mark this doc so the 3-hour reminder knows it hasn't been sent yet
  await event.data.ref.update({ reminderSent3h: false });

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
  await sendToTokens(
    tokens,
    "📢 School Announcement",
    text.length > 120 ? text.slice(0, 117) + "..." : text
  );
});

/* ═══════════════════════════════════════════════════════════
   TRIGGER 3 — Every day 8 AM IST: remind students whose
   homework is due today (no specific time set) and haven't submitted
═══════════════════════════════════════════════════════════ */
exports.dailyDueReminder = onSchedule(
  { schedule: "every day 08:00", timeZone: "Asia/Kolkata" },
  async () => {
    const today = new Date().toISOString().slice(0, 10);

    const hwSnap = await db.collection("homework")
      .where("dueDate", "==", today)
      .get();

    if (hwSnap.empty) { console.log("No homework due today."); return; }

    for (const hwDoc of hwSnap.docs) {
      const hw = hwDoc.data();
      // Skip homework that has a specific dueTime — the 3-hour reminder handles those
      if (hw.dueTime) continue;

      const subSnap = await db.collection("submissions")
        .where("homeworkId", "==", hwDoc.id).get();
      const submittedIds = new Set(subSnap.docs.map(d => d.data().studentId));

      const stuSnap = await db.collection("users")
        .where("role",    "==", "student")
        .where("classId", "==", hw.classId).get();

      const pendingTokens = stuSnap.docs
        .filter(d => !submittedIds.has(d.id))
        .map(d => d.data().fcmToken)
        .filter(Boolean);

      await sendToTokens(
        pendingTokens,
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

    // Collect all date strings that fall in the now → now+3h window
    const dateSet = new Set();
    dateSet.add(now.toISOString().slice(0, 10));
    dateSet.add(in3h.toISOString().slice(0, 10));

    for (const dateStr of dateSet) {
      const hwSnap = await db.collection("homework")
        .where("dueDate",         "==", dateStr)
        .where("reminderSent3h",  "==", false)
        .get();

      for (const hwDoc of hwSnap.docs) {
        const hw = hwDoc.data();
        if (!hw.dueTime) continue; // no time set — handled by dailyDueReminder

        // Build the exact due datetime
        const dueDateTime   = new Date(`${hw.dueDate}T${hw.dueTime}:00`);
        const msUntilDue    = dueDateTime - now;
        const hoursUntilDue = msUntilDue / (1000 * 60 * 60);

        // Only fire when due is within the next 0–3 hours
        if (hoursUntilDue < 0 || hoursUntilDue > 3) continue;

        // Find students in this class who haven't submitted yet
        const subSnap = await db.collection("submissions")
          .where("homeworkId", "==", hwDoc.id).get();
        const submittedIds = new Set(subSnap.docs.map(d => d.data().studentId));

        const stuSnap = await db.collection("users")
          .where("role",    "==", "student")
          .where("classId", "==", hw.classId).get();

        const pendingTokens = stuSnap.docs
          .filter(d => !submittedIds.has(d.id))
          .map(d => d.data().fcmToken)
          .filter(Boolean);

        if (pendingTokens.length > 0) {
          const timeLabel = fmtTime(hw.dueTime);
          await sendToTokens(
            pendingTokens,
            `⚠️ Less Than 3 Hours Left! — ${hw.title}`,
            `${hw.subject || "Homework"} is due at ${timeLabel}. Submit now before the deadline!`
          );
        }

        // Mark reminder as sent so we don't fire again
        await hwDoc.ref.update({ reminderSent3h: true });
      }
    }
  }
);

/* ═══════════════════════════════════════════════════════════
   TRIGGER 5 — Student posts a voice doubt → teacher notified
═══════════════════════════════════════════════════════════ */
exports.onDoubtCreated = onDocumentCreated("doubts/{doubtId}", async (event) => {
  const doubt = event.data?.data();
  if (!doubt?.classId) return;

  const tokens = await getTeacherTokens(doubt.classId);
  await sendToTokens(
    tokens,
    `🎙️ New Voice Doubt — ${doubt.studentName}`,
    `${doubt.studentName} (Class ${doubt.classId}) posted a voice doubt. Tap to listen & reply.`
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
    `${after.reply.teacherName} replied to your voice doubt. Tap to listen!`
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
    ? (ann.text.length > 110 ? ann.text.slice(0, 107) + "..." : ann.text)
    : `${ann.teacherName} sent a voice announcement. Tap to listen!`;

  await sendToTokens(
    tokens,
    `📢 Announcement from ${ann.teacherName}`,
    body
  );
});
