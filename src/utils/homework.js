/* ────────────────────────────────────────────────────────────
   Shared homework helpers — one place for date maths and for
   "which students should do which homework", so every page
   (student, teacher, admin) shows the same numbers.
   ──────────────────────────────────────────────────────────── */

/** "YYYY-MM-DD" for the phone's own (local) date — not UTC. */
export function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The moment homework is due: its due time, or the end of the due day. */
export function dueMoment(dueDate, dueTime) {
  if (!dueDate) return null;
  return new Date(`${dueDate}T${dueTime || "23:59:59"}`);
}

/** Whole calendar days from today to the due date: 0 = today, 1 = tomorrow, -1 = yesterday. */
export function daysUntilDue(dueDate, now = new Date()) {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  const due   = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

/** True once the due moment has passed. */
export function isOverdue(dueDate, dueTime, now = new Date()) {
  const due = dueMoment(dueDate, dueTime);
  return !!due && due < now;
}

/* A student who joins a class (new admission or class change) gets the homework
   posted after they joined PLUS any homework that was still open (not past its
   due date) when they joined. Homework that had already finished isn't theirs. */
export function canSeeHomework(student, hw) {
  const joined = student?.classJoinedAt?.seconds ?? null;
  if (joined === null) return true;
  if ((hw?.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER) >= joined) return true;
  const due = dueMoment(hw?.dueDate, hw?.dueTime);
  return !due || due.getTime() >= joined * 1000;
}

/**
 * Per-homework progress for a class.
 * Returns { submitted: { hwId: n }, total: { hwId: n }, pendingStudents: { hwId: [student] } }
 * counting each student once and only students who should do that homework.
 */
export function homeworkProgress(homeworkList, students, submissions) {
  const submittedBy = {};
  for (const s of submissions) {
    if (!s.homeworkId) continue;
    (submittedBy[s.homeworkId] = submittedBy[s.homeworkId] || new Set()).add(s.studentId);
  }
  const submitted = {}, total = {}, pendingStudents = {};
  for (const hw of homeworkList) {
    const done = submittedBy[hw.id] || new Set();
    const expected = students.filter(st => canSeeHomework(st, hw) || done.has(st.id || st.uid));
    total[hw.id] = expected.length;
    submitted[hw.id] = expected.filter(st => done.has(st.id || st.uid)).length;
    pendingStudents[hw.id] = expected.filter(st => !done.has(st.id || st.uid));
  }
  return { submitted, total, pendingStudents };
}
