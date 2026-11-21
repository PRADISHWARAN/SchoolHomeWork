/* ────────────────────────────────────────────────────────────
   Teacher review of a submission (stored on submissions/{id}.review):
     { status, stars (0–3), remark, sendBack, by, byName, at }
   sendBack = true → the homework goes back to the student's to-do
   list; they submit again and the review is cleared (kept as
   previousReview so the teacher sees what they asked for).
   ──────────────────────────────────────────────────────────── */
export const REVIEW_STATUS = {
  checked:     { emoji: "✅", label: "Checked",                 color: "#047857", bg: "#d1fae5" },
  incomplete:  { emoji: "⚠️", label: "Not properly completed",  color: "#b45309", bg: "#fef3c7" },
  not_brought: { emoji: "📦", label: "Not brought to class",    color: "#b91c1c", bg: "#fee2e2" },
};

export const QUICK_REMARKS = [
  "Excellent work! 🌟",
  "Neat handwriting ✍️",
  "Good effort 👍",
  "Please complete all questions",
  "Write more neatly",
  "Please bring it tomorrow",
  "Photo is not clear — send again",
];

/** Teacher sent this back: the homework is pending again for the student. */
export const isSentBack = (sub) => !!sub?.review?.sendBack;

/** The student has finished this homework (submitted and not sent back). */
export const isDone = (sub) => !!sub && !isSentBack(sub);

/** Stars a student has earned across their submissions. */
export const totalStars = (subs) =>
  subs.reduce((n, s) => n + (isSentBack(s) ? 0 : Number(s.review?.stars) || 0), 0);

/** One submission per homework: the newest one wins. */
export function latestByHomework(subs) {
  const map = {};
  for (const s of subs) {
    const t = s.submittedAt?.seconds ?? 0;
    const cur = map[s.homeworkId];
    if (!cur || t >= (cur.submittedAt?.seconds ?? 0)) map[s.homeworkId] = s;
  }
  return map;
}
