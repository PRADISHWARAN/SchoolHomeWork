/* ────────────────────────────────────────────────────────────
   Seeds the LOCAL Firebase emulators with fake test data so the
   app can be tried out without touching the real school project.

   1. Start emulators:
        firebase emulators:start --only auth,firestore,storage --project demo-schooldesk
   2. Seed (in another terminal):
        node scripts/seed-emulator.js
   3. Create .env.local with REACT_APP_USE_EMULATORS=true and
      REACT_APP_FIREBASE_PROJECT_ID=demo-schooldesk, then `npm start`.

   Test logins (emulator only — these accounts do not exist anywhere real):
     Admin    admin@test.local    / testpass1
     Teacher  teacher@test.local  / testpass1   (class LKG-A)
     Driver   driver@test.local   / testpass1
     Teacher  allclass@test.local / testpass1   ("All classes" teacher)
     No profile noprofile@test.local / testpass1
     Student  phone 9000000001    / DOB 01012019 (class LKG-A)
   ──────────────────────────────────────────────────────────── */
process.env.FIRESTORE_EMULATOR_HOST     ||= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";

const admin = require("../functions/node_modules/firebase-admin");
admin.initializeApp({ projectId: "demo-schooldesk" });
const db   = admin.firestore();
const auth = admin.auth();

const DOMAIN = "vaanavilvidyalaya.com";
const day = n => {
  const d = new Date(Date.now() + n * 864e5);
  return d.toISOString().slice(0, 10);
};
const ts = n => admin.firestore.Timestamp.fromMillis(Date.now() - n * 36e5);

async function user(uid, email, password, profile) {
  try { await auth.deleteUser(uid); } catch { /* not there yet */ }
  await auth.createUser({ uid, email, password });
  await db.doc(`users/${uid}`).set({
    uid, email, createdAt: new Date().toISOString(),
    classJoinedAt: ts(24 * 30), photoURL: "", gender: "Male", birthday: "",
    ...profile,
  });
}

(async () => {
  await user("admin1",   "admin@test.local",   "testpass1", { name: "Head Admin",  role: "admin",   classId: "ALL" });
  await user("teacher1", "teacher@test.local", "testpass1", { name: "Priya Ma'am", role: "teacher", classId: "LKG-A", subjects: ["ALL"], gender: "Female" });
  await user("driver1",  "driver@test.local",  "testpass1", { name: "Ravi Anna",   role: "driver",  classId: "DRIVER" });
  await user("teacherAll", "allclass@test.local", "testpass1", { name: "Kumar Sir", role: "teacher", classId: "ALL", subjects: ["ALL"] });
  // A login with no profile (to see the "Account not set up" screen)
  try { await auth.deleteUser("noprofile1"); } catch { /* not there yet */ }
  await auth.createUser({ uid: "noprofile1", email: "noprofile@test.local", password: "testpass1" });

  const students = [
    ["stu1", "9000000001", "01012019", "Aarav Kumar"],
    ["stu2", "9000000002", "02022019", "Sneha Raj"],
    ["stu3", "9000000003", "03032019", "Karthik Subramanian"],
    ["stu4", "9000000004", "04042019", "Divya Lakshmi"],
    ["stu5", "9000000005", "05052019", "Mohammed Irfan"],
  ];
  for (const [uid, phone, dob, name] of students) {
    await user(uid, `${phone}@${DOMAIN}`, dob, { name, role: "student", classId: "LKG-A", phone, dob });
  }

  const hw = [
    ["hw1", "Write alphabets A to J", "English",     "Write each letter 5 times in your four-line notebook.", day(1), "17:00", 2],
    ["hw2", "Count and colour 1–10",  "Mathematics", "Count the objects on page 12 and colour the correct number.", day(2), null, 20],
    ["hw3", "My family drawing",      "Drawing",     "Draw your family members and write their names below.", day(-1), null, 50],
    ["hw4", "Leaves collection",      "EVS",         "Collect 5 different leaves and stick them in your scrapbook. Bring it to class on Monday.", day(4), "09:00", 70],
  ];
  for (const [id, title, subject, description, dueDate, dueTime, hoursAgo] of hw) {
    await db.doc(`homework/${id}`).set({
      type: "homework", title, subject, description, dueDate, dueTime,
      classId: "LKG-A", teacherId: "teacher1", teacherName: "Priya Ma'am",
      fileUrl: null, fileName: null, gameUrl: null, gamePlatform: null,
      createdAt: ts(hoursAgo), reminderSent3h: false,
    });
  }
  await db.doc("homework/game1").set({
    type: "game", title: "Shapes puzzle", subject: "Game", description: "Finish the shapes level and tell your teacher your score.",
    dueDate: day(3), dueTime: null, classId: "LKG-A", teacherId: "teacher1", teacherName: "Priya Ma'am",
    gameUrl: "https://scratch.mit.edu", gamePlatform: "Scratch", createdAt: ts(5),
  });

  const sub = (id, hwId, title, stu, name, extra) => db.doc(`submissions/${id}`).set({
    homeworkId: hwId, homeworkTitle: title, homeworkType: "homework", classId: "LKG-A",
    studentId: stu, studentName: name, note: "", fileUrl: null, fileName: null,
    bringPhysically: false, submittedAt: ts(1), ...extra,
  });
  await sub("s1", "hw3", "My family drawing", "stu1", "Aarav Kumar", { bringPhysically: true, note: "Will bring tomorrow" });
  await sub("s2", "hw3", "My family drawing", "stu2", "Sneha Raj", { bringPhysically: true });
  await sub("s3", "hw1", "Write alphabets A to J", "stu2", "Sneha Raj", { bringPhysically: true });

  await db.doc("announcements/a1").set({ text: "School will remain closed on Monday for Deepavali holidays.", createdAt: ts(3), createdBy: "Head Admin" });
  await db.doc("announcements/a2").set({ text: "Parent-teacher meeting on Saturday at 10 AM.", createdAt: ts(30), createdBy: "Head Admin" });
  await db.doc("classAnnouncements/c1").set({ classId: "LKG-A", teacherId: "teacher1", teacherName: "Priya Ma'am", text: "Please bring your crayons box tomorrow.", audioUrl: null, createdAt: ts(4) });
  await db.doc("doubts/d1").set({ studentId: "stu1", studentName: "Aarav Kumar", classId: "LKG-A", audioUrl: null, text: "Ma'am, in page 12 do we colour all the apples?", status: "pending", reply: null, createdAt: ts(2) });
  await db.doc("academicCalendar/e1").set({ title: "Annual Day", date: day(10), type: "event", description: "Annual day celebrations" });
  await db.doc("academicCalendar/e2").set({ title: "Term exams begin", date: day(20), type: "exam", description: "" });

  console.log("Emulator seeded ✔  (logins are listed at the top of this file)");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
