import React from "react";
import { REVIEW_STATUS } from "../utils/review";

/** The teacher's review of a submission: result, stars and remark. */
export default function ReviewBadge({ review, compact = false, teacherView = false }) {
  if (!review) {
    return compact ? null : (
      <div className="review-box review-waiting">⏳ Waiting for teacher to check</div>
    );
  }
  const st = REVIEW_STATUS[review.status] || REVIEW_STATUS.checked;
  const stars = Number(review.stars) || 0;

  return (
    <div className="review-box" style={{ background: st.bg, borderColor: st.color + "55" }}>
      <div className="review-head">
        <span style={{ color: st.color, fontWeight: 800 }}>{st.emoji} {st.label}</span>
        {stars > 0 && <span className="review-stars" aria-label={`${stars} stars`}>{"⭐".repeat(stars)}</span>}
        {review.sendBack && <span className="review-sendback">🔁 {teacherView ? "Sent back" : "Please do it again"}</span>}
      </div>
      {!compact && review.remark && <div className="review-remark">“{review.remark}”</div>}
      {!compact && review.byName && <div className="review-by">— {review.byName}</div>}
    </div>
  );
}
