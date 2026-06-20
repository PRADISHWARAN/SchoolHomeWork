import React, { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, doc, updateDoc,
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

/* ── mini audio player ───────────────────────────────────── */
function AudioPlayer({ url, label = "Play" }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={e => {
          const a = e.target;
          if (a.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        style={{ display: "none" }}
      />
      <button onClick={toggle} style={{
        background: playing ? "#ef4444" : "#6366f1",
        color: "white", border: "none", borderRadius: 10,
        padding: "7px 16px", cursor: "pointer", fontWeight: 700,
        fontSize: 13, display: "flex", alignItems: "center", gap: 6,
        flexShrink: 0,
      }}>
        {playing ? "⏸ Pause" : `▶ ${label}`}
      </button>
      <div style={{
        flex: 1, minWidth: 80, height: 6, background: "#e0e7ff",
        borderRadius: 999, overflow: "hidden",
      }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "#6366f1", borderRadius: 999 }} />
      </div>
    </div>
  );
}

/* ── voice recorder hook ─────────────────────────────────── */
function useRecorder() {
  const [recording, setRecording]     = useState(false);
  const [audioBlob, setAudioBlob]     = useState(null);
  const [audioURL,  setAudioURL]      = useState(null);
  const [seconds,   setSeconds]       = useState(0);
  const mediaRef  = useRef(null);
  const chunksRef = useRef([]);
  const timerRef  = useRef(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      toast.error("Microphone permission denied. Please allow microphone access.");
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
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

/* ═══════════════════════════════════════════════════════════
   STUDENT VIEW — record & submit doubts
═══════════════════════════════════════════════════════════ */
function StudentView({ userProfile }) {
  const rec       = useRecorder();
  const [text, setText]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myDoubts, setMyDoubts] = useState([]);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(
      collection(db, "doubts"),
      where("studentId", "==", userProfile.uid),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, snap =>
      setMyDoubts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [userProfile?.uid]);

  async function submit() {
    if (!rec.audioBlob) { toast.error("Please record your doubt first!"); return; }
    setSubmitting(true);
    try {
      const fileName = `doubts/${userProfile.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, rec.audioBlob);
      const audioUrl = await getDownloadURL(storageRef);

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

      toast.success("Doubt sent to your teacher!");
      rec.reset();
      setText("");
    } catch (e) {
      toast.error("Failed to send doubt: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>

      {/* Record card */}
      <div style={card}>
        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 20, color: "#4f46e5", marginBottom: 4 }}>
          🎙️ Ask Your Doubt
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
          Press <b>Start Recording</b>, speak your doubt clearly, then press <b>Stop</b>. Your teacher will reply soon!
        </p>

        {/* Timer */}
        {rec.recording && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#fee2e2", borderRadius: 12, padding: "10px 16px",
            marginBottom: 14, color: "#dc2626", fontWeight: 700,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
            Recording… {fmt(rec.seconds)}
          </div>
        )}

        {/* Record buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {!rec.recording && !rec.audioURL && (
            <button onClick={rec.start} style={{ ...btn, background: "#ef4444" }}>
              🎙️ Start Recording
            </button>
          )}
          {rec.recording && (
            <button onClick={rec.stop} style={{ ...btn, background: "#6b7280" }}>
              ⏹ Stop Recording
            </button>
          )}
          {rec.audioURL && (
            <button onClick={rec.reset} style={{ ...btn, background: "#9ca3af" }}>
              🗑️ Re-record
            </button>
          )}
        </div>

        {/* Preview */}
        {rec.audioURL && (
          <div style={{
            background: "#f0f9ff", border: "1.5px solid #bae6fd",
            borderRadius: 12, padding: "12px 16px", marginBottom: 14,
          }}>
            <div style={{ fontWeight: 600, color: "#0369a1", fontSize: 13, marginBottom: 8 }}>
              Preview your recording:
            </div>
            <AudioPlayer url={rec.audioURL} label="Listen" />
          </div>
        )}

        {/* Optional text */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="(Optional) Type your doubt in words too…"
          rows={2}
          style={{
            width: "100%", borderRadius: 12, border: "1.5px solid #e0e7ff",
            padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
            resize: "vertical", boxSizing: "border-box", marginBottom: 14,
            outline: "none",
          }}
        />

        <button
          onClick={submit}
          disabled={submitting || !rec.audioURL}
          style={{
            ...btn,
            background: rec.audioURL ? "#6366f1" : "#d1d5db",
            cursor: rec.audioURL ? "pointer" : "not-allowed",
            width: "100%", justifyContent: "center",
          }}
        >
          {submitting ? "Sending…" : "📨 Send Doubt to Teacher"}
        </button>
      </div>

      {/* Past doubts */}
      <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 18, color: "#374151", margin: "24px 0 12px" }}>
        📬 My Doubts
      </div>

      {myDoubts.length === 0 && (
        <div style={{ ...emptyBox }}>No doubts sent yet. Ask your first doubt above!</div>
      )}

      {myDoubts.map(d => (
        <div key={d.id} style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <span style={badge(d.status === "replied" ? "#10b981" : "#f59e0b")}>
                {d.status === "replied" ? "✅ Replied" : "⏳ Pending"}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtTime(d.createdAt)}</span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>Your doubt:</div>
            <AudioPlayer url={d.audioUrl} label="Your Doubt" />
            {d.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151" }}>{d.text}</p>}
          </div>

          {d.reply && (
            <div style={{
              background: "#f0fdf4", border: "1.5px solid #bbf7d0",
              borderRadius: 12, padding: "12px 16px", marginTop: 10,
            }}>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 8 }}>
                Teacher's Reply:
              </div>
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
   TEACHER VIEW — listen to doubts and reply
═══════════════════════════════════════════════════════════ */
function TeacherView({ userProfile }) {
  const [doubts, setDoubts]             = useState([]);
  const [activeId, setActiveId]         = useState(null);
  const [replyText, setReplyText]       = useState("");
  const [filter, setFilter]             = useState("pending");
  const rec                             = useRecorder();
  const [replying, setReplying]         = useState(false);

  useEffect(() => {
    if (!userProfile?.classId) return;
    const q = query(
      collection(db, "doubts"),
      where("classId", "==", userProfile.classId),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, snap =>
      setDoubts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [userProfile?.classId]);

  function openReply(id) {
    setActiveId(id);
    setReplyText("");
    rec.reset();
  }

  async function sendReply(doubtId) {
    if (!replyText.trim() && !rec.audioBlob) {
      toast.error("Please type a reply or record a voice reply.");
      return;
    }
    setReplying(true);
    try {
      let replyAudioUrl = null;
      if (rec.audioBlob) {
        const fileName = `doubts/replies/${doubtId}_${Date.now()}.webm`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, rec.audioBlob);
        replyAudioUrl = await getDownloadURL(storageRef);
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

      toast.success("Reply sent!");
      setActiveId(null);
      rec.reset();
      setReplyText("");
    } catch (e) {
      toast.error("Failed to send reply: " + e.message);
    } finally {
      setReplying(false);
    }
  }

  const visible = doubts.filter(d => filter === "all" ? true : d.status === filter);
  const pendingCount = doubts.filter(d => d.status === "pending").length;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ maxWidth: 750, margin: "0 auto" }}>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Doubts",   value: doubts.length,   color: "#6366f1", bg: "#e0e7ff" },
          { label: "Pending",        value: pendingCount,     color: "#f59e0b", bg: "#fffbeb" },
          { label: "Replied",        value: doubts.length - pendingCount, color: "#10b981", bg: "#f0fdf4" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 120, background: s.bg,
            borderRadius: 16, padding: "14px 18px", textAlign: "center",
          }}>
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
            color:      filter === f ? "white" : "#4f46e5",
            padding: "7px 18px", fontSize: 13,
          }}>
            {f === "pending" ? "⏳ Pending" : f === "replied" ? "✅ Replied" : "📋 All"}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={emptyBox}>
          {filter === "pending" ? "No pending doubts — all caught up!" : "No doubts yet in this class."}
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
                fontWeight: 900, fontSize: 16, color: "#92400e",
                flexShrink: 0,
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

          {/* Doubt audio */}
          <div style={{
            background: "#f5f3ff", border: "1.5px solid #ddd6fe",
            borderRadius: 12, padding: "12px 16px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, marginBottom: 8 }}>
              Student's Doubt:
            </div>
            <AudioPlayer url={d.audioUrl} label="Listen to Doubt" />
            {d.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#374151" }}>{d.text}</p>}
          </div>

          {/* Existing reply */}
          {d.reply && (
            <div style={{
              background: "#f0fdf4", border: "1.5px solid #bbf7d0",
              borderRadius: 12, padding: "12px 16px", marginBottom: 10,
            }}>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginBottom: 8 }}>
                Your Reply:
              </div>
              {d.reply.audioUrl && <AudioPlayer url={d.reply.audioUrl} label="Your Voice Reply" />}
              {d.reply.text && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#15803d" }}>{d.reply.text}</p>}
            </div>
          )}

          {/* Reply form */}
          {activeId === d.id ? (
            <div style={{
              background: "#fafafa", border: "1.5px dashed #c7d2fe",
              borderRadius: 12, padding: 16, marginTop: 4,
            }}>
              <div style={{ fontWeight: 700, color: "#4f46e5", fontSize: 14, marginBottom: 12 }}>
                Reply to {d.studentName}:
              </div>

              {/* Voice reply recorder */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 600 }}>
                  🎙️ Voice Reply (optional):
                </div>
                {rec.recording && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "#fee2e2", borderRadius: 10, padding: "8px 14px",
                    color: "#dc2626", fontWeight: 700, fontSize: 13, marginBottom: 8,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
                    Recording… {fmt(rec.seconds)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!rec.recording && !rec.audioURL && (
                    <button onClick={rec.start} style={{ ...btn, background: "#ef4444", fontSize: 12, padding: "6px 14px" }}>
                      🎙️ Record Voice Reply
                    </button>
                  )}
                  {rec.recording && (
                    <button onClick={rec.stop} style={{ ...btn, background: "#6b7280", fontSize: 12, padding: "6px 14px" }}>
                      ⏹ Stop
                    </button>
                  )}
                  {rec.audioURL && (
                    <>
                      <AudioPlayer url={rec.audioURL} label="Preview Reply" />
                      <button onClick={rec.reset} style={{ ...btn, background: "#9ca3af", fontSize: 12, padding: "6px 12px" }}>
                        🗑️ Re-record
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Text reply */}
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
                <button
                  onClick={() => sendReply(d.id)}
                  disabled={replying}
                  style={{ ...btn, background: "#6366f1", flex: 1, justifyContent: "center" }}
                >
                  {replying ? "Sending…" : "✅ Send Reply"}
                </button>
                <button
                  onClick={() => { setActiveId(null); rec.reset(); setReplyText(""); }}
                  style={{ ...btn, background: "#e5e7eb", color: "#374151" }}
                >
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
   ADMIN VIEW — see all doubts across all classes
═══════════════════════════════════════════════════════════ */
function AdminView() {
  const [doubts, setDoubts] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "doubts"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap =>
      setDoubts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  const pending = doubts.filter(d => d.status === "pending").length;

  return (
    <div style={{ maxWidth: 750, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Doubts",   value: doubts.length,          color: "#6366f1", bg: "#e0e7ff" },
          { label: "Pending",        value: pending,                 color: "#f59e0b", bg: "#fffbeb" },
          { label: "Replied",        value: doubts.length - pending, color: "#10b981", bg: "#f0fdf4" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 120, background: s.bg,
            borderRadius: 16, padding: "14px 18px", textAlign: "center",
          }}>
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
      {/* Page header */}
      <div style={{
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        borderRadius: 20, padding: "20px 24px", marginBottom: 24,
        color: "white",
      }}>
        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 24, marginBottom: 4 }}>
          🎙️ Voice Doubts Channel
        </div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>
          {role === "student"
            ? "Record your doubt by voice and your teacher will reply!"
            : role === "teacher"
            ? "Listen to student doubts and send voice or text replies."
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
  background: "white",
  borderRadius: 18,
  padding: "18px 20px",
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
    background: color + "20",
    color,
    border: `1.5px solid ${color}50`,
    borderRadius: 20, padding: "3px 12px",
    fontSize: 12, fontWeight: 700,
  };
}
