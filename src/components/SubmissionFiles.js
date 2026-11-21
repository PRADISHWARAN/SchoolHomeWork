import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { downloadFile } from "../utils/downloadFile";

/* A submission can have several pages (photos / PDFs) in `files`.
   Older submissions only have a single `fileUrl` / `fileName`. */
export function submissionFiles(sub) {
  if (Array.isArray(sub?.files) && sub.files.length) return sub.files;
  return sub?.fileUrl ? [{ url: sub.fileUrl, name: sub.fileName || "submission", type: "" }] : [];
}

const isPdf = f => f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");

/** "📎 View" / "📎 View 3 pages" button that opens every page on one screen. */
export default function SubmissionFiles({ sub, style }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState({}); // pages whose image failed to load
  const files = submissionFiles(sub);
  if (!files.length) return null;

  const close = () => setOpen(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ ...viewBtn, ...style }}>
        📎 {files.length > 1 ? `View ${files.length} pages` : "View"}
      </button>

      {open && createPortal(
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header" style={{ marginBottom: 8 }}>
              <h2 className="modal-title" style={{ fontSize: 18 }}>
                📎 {sub.studentName ? `${sub.studentName}'s work` : "Your work"}
              </h2>
              <button onClick={close} style={closeBtn} aria-label="Close"><X size={18} /></button>
            </div>
            {sub.homeworkTitle && (
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
                {sub.homeworkTitle}{files.length > 1 ? ` · ${files.length} pages` : ""}
              </p>
            )}

            {files.map((f, i) => (
              <div key={f.url} className="viewer-page">
                <div className="viewer-page-head">
                  <span>Page {i + 1}</span>
                  <button type="button" onClick={() => downloadFile(f.url, f.name || `page-${i + 1}`)}>
                    ⬇ Download
                  </button>
                </div>
                {isPdf(f) || broken[i] ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="viewer-file">
                    📄 {f.name || `Page ${i + 1}`} — tap to open
                  </a>
                ) : (
                  <img src={f.url} alt={`Page ${i + 1}`} loading="lazy"
                    onError={() => setBroken(b => ({ ...b, [i]: true }))} />
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const viewBtn = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "#6366f1", fontWeight: 700, fontSize: 13, fontFamily: "inherit",
  whiteSpace: "nowrap",
};
const closeBtn = {
  background: "#f3f4f6", border: "none", borderRadius: 10,
  padding: 7, cursor: "pointer", display: "flex", alignItems: "center", color: "#374151",
};
