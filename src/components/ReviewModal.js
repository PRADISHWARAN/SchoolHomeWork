import React, { useState } from "react";
import { createPortal } from "react-dom";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { REVIEW_STATUS, QUICK_REMARKS } from "../utils/review";
import SubmissionFiles from "./SubmissionFiles";

/** Teacher reviews one submission: result, stars, remark, send back. */
export default function ReviewModal({ sub, onClose, onSaved }) {
  const { userProfile } = useAuth();
  const old = sub.review || {};
  const [status, setStatus]     = useState(old.status || (sub.bringPhysically ? "" : "checked"));
  const [stars, setStars]       = useState(Number(old.stars) || 0);
  const [remark, setRemark]     = useState(old.remark || "");
  const [sendBack, setSendBack] = useState(!!old.sendBack);
  const [saving, setSaving]     = useState(false);

  function pickStatus(s) {
    setStatus(s);
    // Incomplete / not brought usually means "do it again"; checked means done
    setSendBack(s !== "checked");
    if (s !== "checked") setStars(0);
  }

  async function save() {
    if (!status) { toast.error("Choose a result first"); return; }
    setSaving(true);
    try {
      const review = {
        status,
        stars: status === "checked" ? stars : 0,
        remark: remark.trim(),
        sendBack,
        by: userProfile?.uid || "",
        byName: userProfile?.name || "Teacher",
        at: serverTimestamp(),
      };
      await updateDoc(doc(db, "submissions", sub.id), { review });
      toast.success(sendBack ? `Sent back to ${sub.studentName} 🔁` : `Review saved for ${sub.studentName} ✅`);
      onSaved?.({ ...sub, review: { ...review, at: { seconds: Date.now() / 1000 } } });
      onClose();
    } catch (e) {
      toast.error("Could not save review: " + (e.code || e.message));
    }
    setSaving(false);
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header" style={{ marginBottom: 8 }}>
          <h2 className="modal-title" style={{ fontSize: 20 }}>✍️ Review — {sub.studentName}</h2>
          <button onClick={onClose} className="review-close" aria-label="Close"><X size={18} /></button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#6b7280" }}>
          {sub.homeworkTitle}
          {sub.bringPhysically && " · 📚 Said they will bring it to class"}
          {sub.resubmittedAt && " · 🔁 Submitted again"}
        </p>
        {sub.note && <p className="review-note">📝 “{sub.note}”</p>}
        {sub.previousReview?.remark && (
          <p className="review-note">Your earlier remark: “{sub.previousReview.remark}”</p>
        )}
        <div style={{ marginBottom: 14 }}><SubmissionFiles sub={sub} /></div>

        <div className="review-label">Result</div>
        <div className="review-options">
          {Object.entries(REVIEW_STATUS).map(([key, s]) => (
            <button key={key} type="button"
              className={`review-option${status === key ? " active" : ""}`}
              style={status === key ? { background: s.bg, borderColor: s.color, color: s.color } : {}}
              onClick={() => pickStatus(key)}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {status === "checked" && (
          <>
            <div className="review-label">Stars (optional)</div>
            <div className="review-star-row">
              {[1, 2, 3].map(n => (
                <button key={n} type="button" className={`review-star${stars >= n ? " on" : ""}`}
                  onClick={() => setStars(stars === n ? 0 : n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>⭐</button>
              ))}
              <span style={{ fontSize: 13, color: "#9ca3af" }}>{stars ? `${stars} star${stars > 1 ? "s" : ""}` : "no stars"}</span>
            </div>
          </>
        )}

        <div className="review-label">Remark for the student (optional)</div>
        <div className="review-chips">
          {QUICK_REMARKS.map(r => (
            <button key={r} type="button" className="review-chip" onClick={() => setRemark(r)}>{r}</button>
          ))}
        </div>
        <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} maxLength={300}
          placeholder="e.g. Good work, but question 3 is missing" className="review-text" />

        <label className="review-sendback-toggle">
          <input type="checkbox" checked={sendBack} onChange={e => setSendBack(e.target.checked)} />
          <span><b>🔁 Send back to student</b><br />
            <small>The homework goes back to their to-do list so they can do it again.</small></span>
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 2, justifyContent: "center" }}>
            {saving ? "Saving…" : sendBack ? "🔁 Send back" : "✅ Save review"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
