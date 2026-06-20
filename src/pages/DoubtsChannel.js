import React, { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, query, where,
  onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

/* ── helpers ─────────────────────────────────────────────── */
function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function sortDesc(arr) {
  return [...arr].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

/* ── mini audio player ───────────────────────────────────── */
function AudioPlayer({ url, label = "Play" }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    playing ? a.pause() : a.play();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <audio
        ref={audioRef} src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={e => { const a = e.target; if (a.duration) setProgress((a.currentTime / a.duration) * 100); }}
        style={{ display: "none" }}
      />
      <button onClick={toggle} style={{
        background: playing ? "#ef4444" : "#6366f1", color: "white",
        border: "none", borderRadius: 10, padding: "7px 16px",
        cursor: "pointer", fontWeight: 700, fontSize: 13,
        display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
      }}>
        {playing ? "⏸ Pause" : `▶ ${label}`}
      </button>
      <div style={{ flex: 1, minWidth: 80, height: 6, background: "#e0e7ff", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "#6366f1", borderRadius: 999 }} />
      </div>
    </div>
  );
}

/* ── voice recorder hook ─────────────────────────────────── */
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL,  setAudioURL]  = useState(null);
  const [seconds,   setSeconds]   = useState(0);
  const mediaRef  = useRef(null);
  const chunksRef = useRef([]);
  const timerRef  = useRef(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Detect best supported MIME type (iOS Safari needs audio/mp4)
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
        MediaRecorder.isTypeSupported("audio/mp4")  ? "audio/mp4"  :
        MediaRecorder.isTypeSupported("audio/ogg")  ? "audio/ogg"  : "";
      const recorderOpts = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOpts);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Microphone permission denied. Please allow microphone access.");
      } else {
        toast.error("Could not start recording: " + err.message);
      }
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }

  function reset() {
    stop();
    setAudioBlob(null);
    setAudioURL(null);
    setSeconds(0);
  }

  return { recording, audioBlob, audioURL, seconds, start, stop, reset };
}

/* ── skeleton card ───────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="skeleton-line" style={{ width: 80, height: 22 }} />
        <div className="skeleton-line" style={{ width: 60, height: 16 }} />
      </div>
      <div className="skeleton-line" style={{ width: "100%", height: 40, marginBottom: 10 }} />
      <div className="skeleton-line" style={{ width: "70%", height: 16 }} />
    </div>
  );
}

/* ── success overlay ─────────────────────────────────────── */
function SuccessOverlay({ message = "Doubt Sent!" }) {
  return (
    <div className="success-overlay">
      <div className="success-checkmark">✅</div>
      <div className="success-text">{message}</div>
    </div>
  );
}

/* ── sound wave (shown while recording) ─────────────────── */
function SoundWave() {
  return (
    <div className="sound-wave">
      {[1,2,3,4,5].map(i => <div key={i} className="sound-bar" />)}
    </div>
  );
}

/* ── step guide ──────────────────────────────────────────── */
function StepGuide({ step }) {
  const steps = [
    { n: 1, icon: "🎙️", label: "Press Record" },
    { n: 2, icon: "🗣️", label: "Speak Doubt"  },
    { n: 3, icon: "⏹️", label: "Press Stop"   },
    { n: 4, icon: "📨", label: "Send"          },
  ];
  return (
    <div className="voice-steps">
      {steps.map(s => (
        <div key={s.n} className={`voice-step${step === s.n ? " active" : step > s.n ? " done" : ""}`}>
          <span className="voice-step-num">{step > s.n ? "✓" : s.n}</span>
          {s.icon} {s.label}
        </div>
      ))}
    </div>
  );
}

/* ── recording UI helper (compact — for teacher reply) ────── */
function RecorderUI({ rec, size = "normal" }) {
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const p = size === "small" ? { fontSize: 12, padding: "6px 14px" } : {};

  return (
    <div>
      {rec.recording && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#fee2e2", borderRadius: 10, padding: "8px 14px",
          color: "#dc2626", fontWeight: 700, fontSize: 13, marginBottom: 8,
        }}>
          <SoundWave />
          <span style={{ marginLeft: 4 }}>Recording… {fmt(rec.seconds)}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {!rec.recording && !rec.audioURL && (
          <button onClick={rec.start} style={{ ...btn, background: "#ef4444", ...p }}>
            🎙️ {size === "small" ? "Record Voice" : "Start Recording"}
          </button>
        )}
        {rec.recording && (
          <button onClick={rec.stop} style={{ ...btn, background: "#6b7280", ...p }}>
            ⏹ Stop
          </button>
        )}
        {rec.audioURL && (
          <>
            <AudioPlayer url={rec.audioURL} label="Preview" />
            <button onClick={rec.reset} style={{ ...btn, background: "#9ca3af", ...p }}>
              🗑️ Re-record
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEACHER — ANNOUNCE TAB
═══════════════════════════════════════════════════════════ */
function AnnounceTab({ userProfile }) {
  const rec = useRecorder();
  const [text, setText]           = useState("");
  const [sending, setSending]     = useState(false);
  const [announcements, setAnn]   = useState([]);

  useEffect(() => {
    if (!userProfile?.classId) return;
    const q = query(collection(db, "classAnnouncements"), where("classId", "==", userProfile.classId));
    return onSnapshot(q, snap => setAnn(sortDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      err => toast.error("Load error: " + err.message));
  }, [userProfile?.classId]);

  async function sendAnnouncement() {
    if (!rec.audioBlob && !text.trim()) {
      toast.error("Please record a voice message or type an announcement.");
      return;
    }
    setSending(true);
    try {
      let audioUrl = null;
      if (rec.audioBlob) {
        const path = `announcements/${userProfile.classId}_${Date.now()}.webm`;
        const sRef = ref(storage, path);
        await uploadBytes(sRef, rec.audioBlob);
        audioUrl = await getDownloadURL(sRef);
      }
      await addDoc(collection(db, "classAnnouncements"), {
        classId:     userProfile.classId,
        teacherId:   userProfile.uid,
        teacherName: userProfile.name || "Teacher",
        text:        text.trim(),
        audioUrl,
        createdAt:   serverTimestamp(),
      });
      toast.success("Announcement sent to all students!");
      rec.reset();
      setText("");
    } catch (e) {
      toast.error("Failed: " + e.message);
    } finally {
      setSending(false);
    }
  }

  async function deleteAnn(id) {
    try {
      await deleteDoc(doc(db, "classAnnouncements", id));
      toast.success("Announcement deleted.");
    } catch (e) {
      toast.error("Delete failed: " + e.message);
    }
  }

  return (
    <div>
      {/* Compose card */}
      <div style={card}>
        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 18, color: "#7c3aed", marginBottom: 6 }}>
          📢 Send Voice Announcement to Class
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          Record a voice message and/or type text — all students in your class will see it instantly.
        </p>

        {/* Voice */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>
            🎙️ Voice Announcement:
          </div>
          <RecorderUI rec={rec} />
        </div>

        {/* Text */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type your announcement here… (optional if you recorded voice)"
          rows={3}
          style={{
            width: "100%", borderRadius: 12, border: "1.5px solid #e0e7ff",
            padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
            resize: "vertical", boxSizing: "border-box", marginBottom: 14, outline: "none",
          }}
        />

        <button
          onClick={sendAnnouncement}
          disabled={sending || (rec.recording)}
          style={{
            ...btn, background: "#7c3aed", width: "100%",
            justifyContent: "center", opacity: sending ? 0.7 : 1,
          }}
        >
          {sending ? "Sending…" : "📢 Send to All Students"}
        </button>
      </div>

      {/* Past announcements */}
      <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 17, color: "#374151", margin: "22px 0 12px" }}>
        📋 Sent Announcements
      </div>

      {announcements.length === 0 && (
        <div style={emptyBox}>No announcements sent yet.</div>
      )}

      {announcements.map(a => (
        <div key={a.id} style={{ ...card, marginBottom: 12, borderLeft: "4px solid #7c3aed" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>📢 Class Announcement</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtTime(a.createdAt)}</span>
              <button
                onClick={() => deleteAnn(a.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, padding: 0 }}
                title="Delete"
              >🗑️</button>
            </div>
          </div>
          {a.audioUrl && <AudioPlayer url={a.audioUrl} label="Your Voice Message" />}
          {a.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151" }}>{a.text}</p>}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEACHER — DOUBTS TAB
═══════════════════════════════════════════════════════════ */
function DoubtsTab({ userProfile }) {
  const [doubts, setDoubts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeId, setActiveId]     = useState(null);
  const [replyText, setReplyText]   = useState("");
  const [filter, setFilter]         = useState("pending");
  const rec                         = useRecorder();
  const [replying, setReplying]     = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!userProfile?.classId) return;
    const q = query(collection(db, "doubts"), where("classId", "==", userProfile.classId));
    return onSnapshot(q, snap => {
      setDoubts(sortDesc(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      setLoading(false);
    }, err => { toast.error("Could not load doubts: " + err.message); setLoading(false); });
  }, [userProfile?.classId]);

  function openReply(id) { setActiveId(id); setReplyText(""); rec.reset(); }

  async function sendReply(doubtId) {
    if (!replyText.trim() && !rec.audioBlob) {
      toast.error("Please type a reply or record a voice reply.");
      return;
    }
    setReplying(true);
    try {
      // Preserve existing voice reply if teacher only edits the text (no new recording)
      const existingDoubt = doubts.find(d => d.id === doubtId);
      let replyAudioUrl = existingDoubt?.reply?.audioUrl || null;
      if (rec.audioBlob) {
        const ext = rec.audioBlob.type.includes("mp4") ? "mp4" : "webm";
        const path = `doubts/replies/${doubtId}_${Date.now()}.${ext}`;
        const sRef = ref(storage, path);
        await uploadBytes(sRef, rec.audioBlob);
        replyAudioUrl = await getDownloadURL(sRef);
      }
      await updateDoc(doc(db, "doubts", doubtId), {
        status: "replied",
        reply: {
          text:        replyText.trim(),
          audioUrl:    replyAudioUrl,
          repliedAt:   serverTimestamp(),
          teacherName: userProfile.name || "Teacher",
        },
      });
      setActiveId(null); rec.reset(); setReplyText("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2200);
    } catch (e) {
      toast.error("Failed to send reply: " + e.message);
    } finally {
      setReplying(false);
    }
  }

  const visible      = doubts.filter(d => filter === "all" || d.status === filter);
  const pendingCount = doubts.filter(d => d.status === "pending").length;

  return (
    <div>
      {showSuccess && <SuccessOverlay message="Reply Sent! ✅" />}

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Doubts", value: doubts.length,              color: "#6366f1", bg: "#e0e7ff" },
          { label: "Pending",      value: pendingCount,               color: "#f59e0b", bg: "#fffbeb" },
          { label: "Replied",      value: doubts.length - pendingCount, color: "#10b981", bg: "#f0fdf4" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 120, background: s.bg, borderRadius: 16, padding: "14px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["pending", "replied", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            ...btn,
            background: filter === f ? "#6366f1" : "#e0e7ff",
            color:      filter === f ? "white"   : "#4f46e5",
            padding: "7px 18px", fontSize: 13,
          }}>
            {f === "pending" ? "⏳ Pending" : f === "replied" ? "✅ Replied" : "📋 All"}
          </button>
        ))}
      </div>

      {/* skeleton while loading */}
      {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}

      {!loading && visible.length === 0 && (
        <div className="doubts-empty">
          <span className="doubts-empty-emoji">{filter === "pending" ? "🎉" : "📭"}</span>
          <div className="doubts-empty-title">
            {filter === "pending" ? "All caught up!" : "No doubts yet"}
          </div>
          <div className="doubts-empty-sub">
            {filter === "pending" ? "No pending doubts from students." : "Students haven't posted any doubts yet."}
          </div>
        </div>
      )}

      {visible.map(d => (
        <div key={d.id} style={{ ...card, marginBottom: 16 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #fde68a, #f59e0b)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 16, color: "#92400e", flexShrink: 0,
              }}>
                {d.studentName?.[0]?.toUpperCase() || "S"}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{d.studentName}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtTime(d.createdAt)}</div>
              </div>
            </div>
            <span style={badge(d.status === "replied" ? "#10b981" : "#f59e0b")}>
              {d.status === "replied" ? "✅ Replied" : "⏳ Pending"}
            </span>
          </div>

          {/* Doubt */}
          <div style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, marginBottom: 8 }}>Student's Doubt:</div>
            <AudioPlayer url={d.audioUrl} label="Listen to Doubt" />
            {d.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151" }}>{d.text}</p>}
          </div>

          {/* Existing reply */}
          {d.reply && (
            <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 8 }}>Your Reply:</div>
              {d.reply.audioUrl && <AudioPlayer url={d.reply.audioUrl} label="Your Voice Reply" />}
              {d.reply.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#15803d" }}>{d.reply.text}</p>}
            </div>
          )}

          {/* Reply form */}
          {activeId === d.id ? (
            <div style={{ background: "#fafafa", border: "1.5px dashed #c7d2fe", borderRadius: 12, padding: 16, marginTop: 4 }}>
              <div style={{ fontWeight: 700, color: "#4f46e5", fontSize: 14, marginBottom: 12 }}>
                Reply to {d.studentName}:
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 600 }}>🎙️ Voice Reply (optional):</div>
                <RecorderUI rec={rec} size="small" />
              </div>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply here…"
                rows={3}
                style={{
                  width: "100%", borderRadius: 10, border: "1.5px solid #e0e7ff",
                  padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
                  resize: "vertical", boxSizing: "border-box", marginBottom: 12, outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => sendReply(d.id)} disabled={replying}
                  style={{ ...btn, background: "#6366f1", flex: 1, justifyContent: "center" }}>
                  {replying ? "Sending…" : "✅ Send Reply"}
                </button>
                <button onClick={() => { setActiveId(null); rec.reset(); setReplyText(""); }}
                  style={{ ...btn, background: "#e5e7eb", color: "#374151" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => openReply(d.id)} style={{
              ...btn,
              background: d.status === "replied" ? "#e0e7ff" : "#6366f1",
              color:      d.status === "replied" ? "#4f46e5" : "white",
              marginTop: 4,
            }}>
              {d.status === "replied" ? "✏️ Edit Reply" : "💬 Reply"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEACHER VIEW — tabs: Announce | Doubts
═══════════════════════════════════════════════════════════ */
function TeacherView({ userProfile }) {
  const [tab, setTab] = useState("doubts");

  return (
    <div style={{ maxWidth: 750, margin: "0 auto" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22, borderBottom: "2px solid #e0e7ff", paddingBottom: 0 }}>
        {[
          { id: "doubts",    label: "📋 Student Doubts",       color: "#6366f1" },
          { id: "announce",  label: "📢 Announce to Class",    color: "#7c3aed" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            border: "none", background: "none", cursor: "pointer",
            fontFamily: "'Fredoka One', cursive", fontSize: 15,
            padding: "10px 18px", borderRadius: "12px 12px 0 0",
            color:       tab === t.id ? t.color        : "#9ca3af",
            background:  tab === t.id ? "#e0e7ff"      : "transparent",
            borderBottom: tab === t.id ? `3px solid ${t.color}` : "3px solid transparent",
            fontWeight: 400,
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "doubts"   && <DoubtsTab   userProfile={userProfile} />}
      {tab === "announce" && <AnnounceTab userProfile={userProfile} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENT VIEW — announcements + submit doubt + history
═══════════════════════════════════════════════════════════ */
function StudentView({ userProfile }) {
  const rec       = useRecorder();
  const [text, setText]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [myDoubts, setMyDoubts]     = useState([]);
  const [doubtsLoading, setDoubtsLoading] = useState(true);
  const [announcements, setAnn]     = useState([]);

  /* load my doubts */
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(collection(db, "doubts"), where("studentId", "==", userProfile.uid));
    return onSnapshot(q, snap => {
      setMyDoubts(sortDesc(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      setDoubtsLoading(false);
    }, err => { toast.error("Could not load doubts: " + err.message); setDoubtsLoading(false); });
  }, [userProfile?.uid]);

  /* load teacher announcements */
  useEffect(() => {
    if (!userProfile?.classId) return;
    const q = query(collection(db, "classAnnouncements"), where("classId", "==", userProfile.classId));
    return onSnapshot(q,
      snap => setAnn(sortDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      err => toast.error("Could not load announcements: " + err.message)
    );
  }, [userProfile?.classId]);

  async function submit() {
    if (!rec.audioBlob && !text.trim()) {
      toast.error("Please record your doubt or type your question!");
      return;
    }
    setSubmitting(true);
    try {
      let audioUrl = null;
      if (rec.audioBlob) {
        const ext = rec.audioBlob.type.includes("mp4") ? "mp4" : rec.audioBlob.type.includes("ogg") ? "ogg" : "webm";
        const path = `doubts/${userProfile.uid}_${Date.now()}.${ext}`;
        const sRef = ref(storage, path);
        await uploadBytes(sRef, rec.audioBlob);
        audioUrl = await getDownloadURL(sRef);
      }
      await addDoc(collection(db, "doubts"), {
        studentId:   userProfile.uid,
        studentName: userProfile.name || "Student",
        classId:     userProfile.classId,
        audioUrl,
        text:        text.trim(),
        status:      "pending",
        createdAt:   serverTimestamp(),
        reply:       null,
      });
      rec.reset(); setText("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2200);
    } catch (e) {
      toast.error("Failed to send doubt: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  /* which step is active */
  const step = rec.recording ? 2 : rec.audioURL ? 3 : submitting ? 4 : 1;
  const fmt  = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {showSuccess && <SuccessOverlay message="Doubt Sent to Teacher! 🎉" />}

      {/* ── Teacher Announcements ── */}
      {announcements.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 18, color: "#7c3aed", marginBottom: 12 }}>
            📢 Teacher's Announcements
          </div>
          {announcements.map(a => (
            <div key={a.id} style={{
              ...card, marginBottom: 12,
              borderLeft: "4px solid #7c3aed",
              background: "linear-gradient(135deg, #faf5ff, #fff)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg, #c4b5fd, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  }}>👩‍🏫</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#4c1d95" }}>{a.teacherName}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtTime(a.createdAt)}</div>
                  </div>
                </div>
                <span style={badge("#7c3aed")}>📢 Announcement</span>
              </div>
              {a.audioUrl && <div style={{ marginBottom: a.text ? 10 : 0 }}><AudioPlayer url={a.audioUrl} label="Listen to Announcement" /></div>}
              {a.text && <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{a.text}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Ask Doubt ── */}
      <div style={card}>
        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 20, color: "#4f46e5", marginBottom: 6 }}>
          🎙️ Ask Your Doubt
        </div>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
          Record your voice <strong>or</strong> type your question below — either works! 🎤✍️
        </p>

        {/* Step guide */}
        <StepGuide step={step} />

        {/* Big circular record button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 20 }}>
          {!rec.audioURL && (
            <button
              className={`record-btn-big${rec.recording ? " stop-mode" : ""}`}
              onClick={rec.recording ? rec.stop : rec.start}
            >
              {rec.recording && <><div className="record-ring" /><div className="record-ring" /></>}
              {rec.recording ? "⏹" : "🎙️"}
            </button>
          )}

          {/* Recording timer + wave */}
          {rec.recording && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <SoundWave />
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16, color: "#ef4444" }}>
                {fmt(rec.seconds)} — Listening…
              </div>
            </div>
          )}

          {/* Preview after recording */}
          {rec.audioURL && (
            <div style={{ width: "100%", background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, color: "#0369a1", fontSize: 13, marginBottom: 10 }}>
                🎧 Preview your recording:
              </div>
              <AudioPlayer url={rec.audioURL} label="Listen Back" />
              <button onClick={rec.reset} style={{ ...btn, background: "#fee2e2", color: "#dc2626", fontSize: 12, padding: "6px 14px", marginTop: 10 }}>
                🗑️ Re-record
              </button>
            </div>
          )}

          {!rec.recording && !rec.audioURL && (
            <div style={{ fontSize: 13, color: "#9ca3af", fontFamily: "'Fredoka One', cursive" }}>
              Tap the big button to start
            </div>
          )}
        </div>

        {/* Optional text */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="(Optional) Type your doubt in words too…"
          rows={2}
          style={{
            width: "100%", borderRadius: 12, border: "1.5px solid #e0e7ff",
            padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
            resize: "vertical", boxSizing: "border-box", marginBottom: 14, outline: "none",
          }}
        />

        <button
          onClick={submit}
          disabled={submitting || !rec.audioURL}
          style={{
            ...btn,
            background: rec.audioURL ? "#6366f1" : "#d1d5db",
            cursor: rec.audioURL ? "pointer" : "not-allowed",
            width: "100%", justifyContent: "center", fontSize: 16,
            padding: "13px 20px",
          }}
        >
          {submitting ? "Sending…" : "📨 Send Doubt to Teacher"}
        </button>
      </div>

      {/* ── My Doubts history ── */}
      <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 18, color: "#374151", margin: "24px 0 12px" }}>
        📬 My Doubts
      </div>

      {/* skeleton while loading */}
      {doubtsLoading && <><SkeletonCard /><SkeletonCard /></>}

      {/* friendly empty state */}
      {!doubtsLoading && myDoubts.length === 0 && (
        <div className="doubts-empty">
          <span className="doubts-empty-emoji">🤔</span>
          <div className="doubts-empty-title">No doubts yet!</div>
          <div className="doubts-empty-sub">Press the big red button above and ask your first doubt.</div>
        </div>
      )}

      {myDoubts.map(d => (
        <div key={d.id} style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <span style={badge(d.status === "replied" ? "#10b981" : "#f59e0b")}>
              {d.status === "replied" ? "✅ Replied" : "⏳ Pending"}
            </span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtTime(d.createdAt)}</span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>Your doubt:</div>
            <AudioPlayer url={d.audioUrl} label="Your Doubt" />
            {d.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151" }}>{d.text}</p>}
          </div>

          {d.reply && (
            <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "12px 16px", marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 8 }}>Teacher's Reply:</div>
              {d.reply.audioUrl && <AudioPlayer url={d.reply.audioUrl} label="Teacher's Voice Reply" />}
              {d.reply.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#15803d" }}>{d.reply.text}</p>}
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                — {d.reply.teacherName} · {fmtTime(d.reply.repliedAt)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN VIEW
═══════════════════════════════════════════════════════════ */
function AdminView() {
  const [doubts, setDoubts] = useState([]);

  useEffect(() => {
    return onSnapshot(query(collection(db, "doubts")),
      snap => setDoubts(sortDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      err => toast.error("Could not load doubts: " + err.message)
    );
  }, []);

  const pending = doubts.filter(d => d.status === "pending").length;

  return (
    <div style={{ maxWidth: 750, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Doubts", value: doubts.length,              color: "#6366f1", bg: "#e0e7ff" },
          { label: "Pending",      value: pending,                    color: "#f59e0b", bg: "#fffbeb" },
          { label: "Replied",      value: doubts.length - pending,    color: "#10b981", bg: "#f0fdf4" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 120, background: s.bg, borderRadius: 16, padding: "14px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {doubts.length === 0 && <div style={emptyBox}>No doubts raised yet by any student.</div>}

      {doubts.map(d => (
        <div key={d.id} style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div>
              <span style={{ fontWeight: 700 }}>{d.studentName}</span>
              <span style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8 }}>Class {d.classId}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={badge(d.status === "replied" ? "#10b981" : "#f59e0b")}>
                {d.status === "replied" ? "✅ Replied" : "⏳ Pending"}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtTime(d.createdAt)}</span>
            </div>
          </div>
          <AudioPlayer url={d.audioUrl} label="Listen to Doubt" />
          {d.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151" }}>{d.text}</p>}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT EXPORT
═══════════════════════════════════════════════════════════ */
export default function DoubtsChannel() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;

  return (
    <div>
      <div style={{
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        borderRadius: 20, padding: "20px 24px", marginBottom: 24, color: "white",
      }}>
        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 24, marginBottom: 4 }}>
          🎙️ Voice Doubts Channel
        </div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>
          {role === "student"
            ? "See teacher announcements & record your doubts by voice!"
            : role === "teacher"
            ? "Send voice announcements to your class & reply to student doubts."
            : "Overview of all doubts across the school."}
        </div>
      </div>

      {role === "student" && <StudentView userProfile={userProfile} />}
      {role === "teacher" && <TeacherView userProfile={userProfile} />}
      {role === "admin"   && <AdminView />}
    </div>
  );
}

/* ── shared styles ────────────────────────────────────────── */
const card = {
  background: "white", borderRadius: 18, padding: "18px 20px",
  boxShadow: "0 4px 20px rgba(99,102,241,0.08)",
  border: "1.5px solid rgba(99,102,241,0.1)",
};

const btn = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "9px 20px", borderRadius: 12, border: "none",
  background: "#6366f1", color: "white",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
};

const emptyBox = {
  background: "#f9fafb", border: "1.5px dashed #d1d5db",
  borderRadius: 16, padding: "32px 20px", textAlign: "center",
  color: "#9ca3af", fontSize: 14,
};

function badge(color) {
  return {
    display: "inline-block",
    background: color + "20", color,
    border: `1.5px solid ${color}50`,
    borderRadius: 20, padding: "3px 12px",
    fontSize: 12, fontWeight: 700,
  };
}
