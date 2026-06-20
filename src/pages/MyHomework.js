import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Upload, X, FileUp, Star } from "lucide-react";
import toast from "react-hot-toast";
import { downloadFile } from "../utils/downloadFile";

const SUBJECT_CONFIG = {
  Mathematics:         { emoji: "🔢", color: "#f59e0b", bg: "#fef3c7" },
  English:             { emoji: "📖", color: "#6366f1", bg: "#e0e7ff" },
  Science:             { emoji: "🔬", color: "#10b981", bg: "#d1fae5" },
  "Social Studies":    { emoji: "🌍", color: "#0891b2", bg: "#cffafe" },
  Hindi:               { emoji: "🕉️",  color: "#7c3aed", bg: "#ede9fe" },
  Tamil:               { emoji: "📜", color: "#dc2626", bg: "#fee2e2" },
  Computer:            { emoji: "💻", color: "#0284c7", bg: "#e0f2fe" },
  Drawing:             { emoji: "🎨", color: "#d97706", bg: "#fef3c7" },
  EVS:                 { emoji: "🌿", color: "#059669", bg: "#d1fae5" },
  "General Knowledge": { emoji: "🧠", color: "#7c3aed", bg: "#ede9fe" },
  Game:                { emoji: "🎮", color: "#ec4899", bg: "#fce7f3" },
};
const DEFAULT_SUB = { emoji: "📚", color: "#6366f1", bg: "#e0e7ff" };

const PLATFORM_EMOJI = { Scratch: "🐱", Kahoot: "🎯", Quizlet: "🃏", "Google Forms": "📝", Other: "🎮" };

const MOTIVATIONS = [
  "You're a homework hero! 🦸",
  "Keep crushing it, superstar! ⭐",
  "Big brain energy today! 🧠",
  "Learning is your superpower! 💪",
  "You're absolutely unstoppable! 🚀",
  "Every task done = level up! 🎮",
];

function chip(color, bg) {
  return { background: bg, color, fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 50, display: "inline-flex", alignItems: "center", gap: 4 };
}

function DaysLeft({ dueDate, dueTime }) {
  const due = new Date(dueDate + (dueTime ? `T${dueTime}` : "T23:59:59"));
  if (!dueTime) due.setSeconds(59);
  const days = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0)  return <span style={chip("#ef4444", "#fee2e2")}>⚠️ Overdue!</span>;
  if (days === 0) return <span style={chip("#f59e0b", "#fef3c7")}>🔥 Due Today!</span>;
  if (days === 1) return <span style={chip("#f59e0b", "#fef3c7")}>⏰ Due Tomorrow!</span>;
  if (days <= 3)  return <span style={chip("#0891b2", "#cffafe")}>📅 {days} days left</span>;
  return <span style={chip("#10b981", "#d1fae5")}>📅 {days} days left</span>;
}


export default function MyHomework() {
  const { userProfile, currentUser } = useAuth();
  const [homeworkList, setHomeworkList] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedHw, setSelectedHw] = useState(null);
  const [subForm, setSubForm] = useState({ note: "", file: null, bringPhysically: false });
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [motivation] = useState(MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    if (!userProfile?.classId) { setLoading(false); return; }
    setLoading(true);
    try {
      const hwQ = query(collection(db, "homework"), where("classId", "==", userProfile.classId));
      const hwSnap = await getDocs(hwQ);
      const joinedAt = userProfile?.classJoinedAt?.seconds ?? null;
      const hw = hwSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(h => joinedAt === null || (h.createdAt?.seconds || 0) >= joinedAt);
      hw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHomeworkList(hw);

      const subQ = query(collection(db, "submissions"), where("studentId", "==", currentUser.uid));
      const subSnap = await getDocs(subQ);
      const subMap = {};
      subSnap.docs.forEach(d => { subMap[d.data().homeworkId] = { id: d.id, ...d.data() }; });
      setSubmissions(subMap);
    } catch { toast.error("Failed to load homework"); }
    setLoading(false);
  }

  function openSubmit(hw) {
    const preNote = hw.type === "game" ? "I played and completed the game! 🎮" : "";
    setSubForm({ note: preNote, file: null, bringPhysically: false });
    setShowSubmitConfirm(false);
    setSelectedHw(hw);
  }

  function validateSubmission() {
    if (!subForm.file && !subForm.bringPhysically) {
      toast.error("Please upload your work (photo/PDF) or tick 'I will bring it physically' 📎");
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validateSubmission()) return;
    setSubmitting(true);
    try {
      let fileUrl = null, fileName = null;
      if (subForm.file) {
        const fileRef = ref(storage, `submissions/${currentUser.uid}/${Date.now()}_${subForm.file.name}`);
        await uploadBytes(fileRef, subForm.file);
        fileUrl = await getDownloadURL(fileRef);
        fileName = subForm.file.name;
      }
      await addDoc(collection(db, "submissions"), {
        homeworkId: selectedHw.id,
        homeworkTitle: selectedHw.title,
        homeworkType: selectedHw.type || "homework",
        classId: userProfile.classId,
        studentId: currentUser.uid,
        studentName: userProfile.name,
        note: subForm.note,
        fileUrl, fileName,
        bringPhysically: subForm.bringPhysically,
        submittedAt: serverTimestamp(),
      });

      const msg = selectedHw.type === "game"
        ? "🎮 Game marked complete!"
        : "🎉 Homework submitted!";
      toast.success(msg);
      setSelectedHw(null);
      setSubForm({ note: "", file: null, bringPhysically: false });
      setShowSubmitConfirm(false);
      fetchData();
    } catch { toast.error("Failed to submit"); }
    setSubmitting(false);
  }

  if (loading) return <div className="loader"><div className="spinner" /><span>Loading your work... 📚</span></div>;

  /* ── Unique subjects that have homework (for filter tabs) ── */
  const subjectsWithHw = [
    "All",
    ...Array.from(new Set(homeworkList.map((h) => h.subject).filter(Boolean))).sort(),
  ];

  /* ── Apply subject filter ── */
  const visibleList = subjectFilter === "All"
    ? homeworkList
    : homeworkList.filter((h) => h.subject === subjectFilter);

  const games      = visibleList.filter(hw => hw.type === "game");
  const regularHw  = visibleList.filter(hw => hw.type !== "game");
  const pendingGames  = games.filter(hw => !submissions[hw.id]);
  const doneGames     = games.filter(hw =>  submissions[hw.id]);
  const pendingHw     = regularHw.filter(hw => !submissions[hw.id]);
  const doneHw        = regularHw.filter(hw =>  submissions[hw.id]);

  const totalDone  = Object.keys(submissions).length;
  const totalAll   = homeworkList.length;

  return (
    <div>
      {/* Header Banner */}
      <div className="myhw-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #312e81 0%, #6366f1 55%, #8b5cf6 100%)",
        borderRadius: 24, padding: "22px 28px", marginBottom: 20, gap: 16,
        boxShadow: "0 8px 32px rgba(99,102,241,0.35)", flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="myhw-header-title" style={{
            color: "white", fontFamily: "'Fredoka One', cursive",
            fontWeight: 400, fontSize: 28, marginBottom: 4,
          }}>
            🎯 My Missions!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
            Class {userProfile?.classId} · {motivation}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Chip icon="⏳" color="#f59e0b" bg="#fef3c7" label={`${pendingHw.length + pendingGames.length} Pending`} />
            <Chip icon="✅" color="#10b981" bg="#d1fae5" label={`${totalDone} Done`} />
          </div>
        </div>
      </div>

      {/* ── Subject filter tabs ── */}
      {subjectsWithHw.length > 1 && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          marginBottom: 20, padding: "4px 0",
        }}>
          {subjectsWithHw.map((sub) => {
            const active = subjectFilter === sub;
            return (
              <button
                key={sub}
                onClick={() => setSubjectFilter(sub)}
                style={{
                  padding: "8px 18px", borderRadius: 50, fontSize: 13,
                  fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.18s",
                  border: `2px solid ${active ? "#6366f1" : "#e0e7ff"}`,
                  background: active
                    ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                    : "white",
                  color: active ? "white" : "#6b7280",
                  boxShadow: active ? "0 4px 14px rgba(99,102,241,0.3)" : "none",
                }}
              >
                {sub === "All" ? "📚 All Subjects" : sub}
              </button>
            );
          })}
        </div>
      )}

      {/* ======= GAMES ZONE ======= */}
      {games.length > 0 && (
        <div className="game-zone">
          <div className="game-zone-title">🎮 Games Zone!</div>

          {pendingGames.length > 0 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>
                🔥 Play & Complete
              </div>
              {pendingGames.map(hw => (
                <GameCard key={hw.id} hw={hw} status="pending" onMarkDone={() => openSubmit(hw)} />
              ))}
            </>
          )}

          {doneGames.length > 0 && (
            <>
              {pendingGames.length > 0 && <div style={{ marginTop: 16 }} />}
              <div style={{ fontSize: 14, fontWeight: 700, color: "#059669", marginBottom: 10 }}>
                ✅ Completed Games
              </div>
              {doneGames.map(hw => (
                <GameCard key={hw.id} hw={hw} status="done" submission={submissions[hw.id]} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ======= HOMEWORK ======= */}
      {pendingHw.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{
            fontSize: 20, fontFamily: "'Fredoka One', cursive", fontWeight: 400,
            color: "#dc2626", marginBottom: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            🔥 Active Missions ({pendingHw.length})
          </h2>
          {pendingHw.map(hw => (
            <HomeworkCard key={hw.id} hw={hw} status="pending" onSubmit={() => openSubmit(hw)} />
          ))}
        </div>
      )}

      {doneHw.length > 0 && (
        <div>
          <h2 style={{
            fontSize: 20, fontFamily: "'Fredoka One', cursive", fontWeight: 400,
            color: "#059669", marginBottom: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            ✅ Completed Missions ({doneHw.length})
          </h2>
          {doneHw.map(hw => (
            <HomeworkCard key={hw.id} hw={hw} status="submitted" submission={submissions[hw.id]} />
          ))}
        </div>
      )}

      {homeworkList.length === 0 && (
        <div className="card empty-fun" style={{ paddingTop: 48 }}>
          <span className="empty-fun-emoji">🎉</span>
          <h3>No missions yet!</h3>
          <p>Your teacher hasn't posted anything yet — enjoy the break! 🥳</p>
        </div>
      )}

      {homeworkList.length > 0 && visibleList.length === 0 && (
        <div className="card empty-fun" style={{ paddingTop: 32 }}>
          <span className="empty-fun-emoji">📭</span>
          <h3>No {subjectFilter} homework!</h3>
          <p>No homework posted for {subjectFilter} yet. Check another subject! 😊</p>
        </div>
      )}

      {/* Submit Modal */}
      {selectedHw && (
        <div className="modal-overlay" onClick={() => setSelectedHw(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {selectedHw.type === "game" ? "🎮 Complete Game" : "✏️ Submit Homework"}
              </h2>
              <button onClick={() => setSelectedHw(null)} style={closeBtn}><X size={18} /></button>
            </div>

            {/* Subject banner */}
            <div style={subjectBanner(selectedHw.subject, selectedHw.type)}>
              <span style={{ fontSize: 28 }}>
                {selectedHw.type === "game"
                  ? (PLATFORM_EMOJI[selectedHw.gamePlatform] || "🎮")
                  : (SUBJECT_CONFIG[selectedHw.subject] || DEFAULT_SUB).emoji}
              </span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: "white" }}>{selectedHw.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                  {selectedHw.type === "game"
                    ? `${selectedHw.gamePlatform || "Game"} · Due: ${selectedHw.dueDate}${selectedHw.dueTime ? ` ${new Date(`2000-01-01T${selectedHw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`
                    : `${selectedHw.subject} · Due: ${selectedHw.dueDate}${selectedHw.dueTime ? ` ${new Date(`2000-01-01T${selectedHw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                </div>
              </div>
            </div>

            {selectedHw.type === "game" && selectedHw.gameUrl && (
              <a href={selectedHw.gameUrl} target="_blank" rel="noreferrer"
                className="play-btn"
                style={{ display: "flex", justifyContent: "center", marginBottom: 16, textDecoration: "none" }}>
                ▶ Play the Game First!
              </a>
            )}

            <div className="form-group">
              <label>Your Note / Comment</label>
              <textarea
                placeholder={selectedHw.type === "game"
                  ? "Tell your teacher what you thought of the game!"
                  : "Write any notes... (e.g. 'Completed all 10 problems')"}
                value={subForm.note}
                onChange={e => setSubForm({ ...subForm, note: e.target.value })}
              />
            </div>

            {selectedHw.type !== "game" && (
              <div className="form-group">
                <label>Upload Your Work (Photo / PDF)</label>
                <div className="file-upload-area" onClick={() => document.getElementById("sub-file").click()}>
                  <FileUp size={24} color="#6366f1" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 14, color: "#6366f1", fontWeight: 700 }}>
                    {subForm.file ? subForm.file.name : "Click to upload"}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Take a photo of your work and upload it</div>
                </div>
                <input id="sub-file" type="file" accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: "none" }} onChange={e => setSubForm({ ...subForm, file: e.target.files[0] })} />
              </div>
            )}

            {selectedHw.type !== "game" && (
              <div style={{ border: "2px solid #e0e7ff", borderRadius: 12, padding: "14px 16px", background: "#f8f9ff" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={subForm.bringPhysically}
                    onChange={e => setSubForm({ ...subForm, bringPhysically: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: "#6366f1" }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>📚 I will bring it physically to school</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Select this if you've done it in your notebook</div>
                  </div>
                </label>
              </div>
            )}

            {showSubmitConfirm && (
              <div style={{
                background: "#fff7ed", border: "2px solid #fb923c",
                borderRadius: 14, padding: "14px 16px", marginTop: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "#c2410c", fontFamily: "'Nunito', sans-serif" }}>
                    Are you sure you want to submit?
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#9a3412", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Once submitted, <strong>this cannot be undone</strong>. Make sure your work is complete before confirming.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, border: "2px solid #fb923c",
                      background: "white", color: "#c2410c", fontWeight: 800,
                      fontFamily: "'Nunito', sans-serif", fontSize: 13, cursor: "pointer",
                    }}
                  >
                    ← Go Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      flex: 2, padding: "9px 0", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #ea580c, #dc2626)",
                      color: "white", fontWeight: 800,
                      fontFamily: "'Nunito', sans-serif", fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {submitting ? "Submitting... 🚀" : "✅ Yes, Submit Now!"}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => { setSelectedHw(null); setShowSubmitConfirm(false); }} style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
              {!showSubmitConfirm && (
                <button className="btn btn-primary" onClick={() => { if (validateSubmission()) setShowSubmitConfirm(true); }}
                  style={{
                    flex: 2, justifyContent: "center", fontSize: 15,
                    background: selectedHw.type === "game"
                      ? "linear-gradient(135deg, #f59e0b, #ec4899)"
                      : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  }}>
                  {selectedHw.type === "game" ? "🎮 Mark as Complete!" : <><Upload size={16} /> Submit Homework</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, color, bg, label }) {
  return (
    <span style={{ background: bg, color, fontWeight: 800, fontSize: 13, padding: "5px 12px", borderRadius: 50, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "'Nunito', sans-serif" }}>
      {icon} {label}
    </span>
  );
}

function GameCard({ hw, status, onMarkDone, submission }) {
  const platformEmoji = PLATFORM_EMOJI[hw.gamePlatform] || "🎮";
  const isDone = status === "done";

  return (
    <div className="game-card">
      <div style={{
        width: 56, height: 56, borderRadius: 16, flexShrink: 0,
        background: "linear-gradient(135deg, #fef3c7, #fce7f3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, border: "2px solid #fde68a",
      }}>
        {platformEmoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#1e1b4b", fontFamily: "'Nunito', sans-serif" }}>
          {hw.title}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", margin: "4px 0" }}>{hw.description}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 50 }}>
            🎮 {hw.gamePlatform || "Game"}
          </span>
          {hw.dueDate && <DaysLeft dueDate={hw.dueDate} dueTime={hw.dueTime} />}
          {hw.createdAt?.seconds && (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              📌 Posted: {new Date(hw.createdAt.seconds * 1000).toLocaleDateString()}
            </span>
          )}
          {isDone && <span style={{ background: "#d1fae5", color: "#059669", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 50 }}>✅ Done!</span>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "flex-end" }}>
        {hw.gameUrl && (
          <button
            className="play-btn"
            onClick={() => window.open(hw.gameUrl, "_blank", "noopener,noreferrer")}
          >
            ▶ {isDone ? "Play Again" : "PLAY!"}
          </button>
        )}
        {!isDone && (
          <button
            onClick={onMarkDone}
            style={{
              background: "#d1fae5", color: "#059669", border: "none",
              borderRadius: 50, padding: "8px 16px",
              fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 800,
              cursor: "pointer", boxShadow: "0 3px 0 rgba(16,185,129,0.25)",
              transition: "all 0.12s",
            }}
          >
            ✅ Mark Done
          </button>
        )}
      </div>
    </div>
  );
}

function HomeworkCard({ hw, status, onSubmit, submission }) {
  const sub = SUBJECT_CONFIG[hw.subject] || DEFAULT_SUB;
  const isPending = status === "pending";

  return (
    <div className={`mission-card ${isPending ? "pending" : "done"}`}
      style={{ borderColor: isPending ? sub.color + "80" : "#6ee7b7" }}>
      <div style={{ display: "flex", gap: 0 }}>
        {/* Subject colour strip */}
        <div style={{
          width: 68, background: sub.bg,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 30, gap: 4, padding: "8px 0",
        }}>
          {sub.emoji}
          {isPending && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: sub.color,
              fontFamily: "'Fredoka One', cursive",
              background: "white", borderRadius: 6, padding: "1px 5px",
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}>TASK</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "14px 16px", minWidth: 0 }}>
          {/* Mission label for pending */}
          {isPending && (
            <span className="mission-label" style={{ marginBottom: 8, display: "inline-flex" }}>
              ⚔️ MISSION
            </span>
          )}

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: isPending ? 6 : 0 }}>
            <div>
              <div style={{
                fontWeight: 400, fontSize: 17, color: "#1e1b4b",
                fontFamily: "'Fredoka One', cursive",
              }}>{hw.title}</div>
              <span style={{ ...chip(sub.color, sub.bg), marginTop: 4, display: "inline-flex" }}>
                {hw.subject}
              </span>
            </div>
            {isPending && (
              <button className="mission-btn pulse-glow" onClick={onSubmit}
                style={{
                  background: `linear-gradient(135deg, ${sub.color}, ${sub.color}cc)`,
                  boxShadow: `0 4px 0 ${sub.color}55`,
                }}>
                🚀 Accept Mission!
              </button>
            )}
            {!isPending && (
              <span style={{
                ...chip("#10b981", "#d1fae5"),
                fontSize: 13, padding: "6px 14px",
                fontFamily: "'Fredoka One', cursive",
              }}>✅ Mission Complete!</span>
            )}
          </div>

          <div style={{ color: "#6b7280", fontSize: 13, margin: "8px 0", lineHeight: 1.5 }}>
            {hw.description}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {hw.dueDate && isPending && <DaysLeft dueDate={hw.dueDate} dueTime={hw.dueTime} />}
            {hw.createdAt?.seconds && (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                📌 Posted: {new Date(hw.createdAt.seconds * 1000).toLocaleDateString()}
              </span>
            )}
            <span style={{ fontSize: 12, color: "#9ca3af" }}>👩‍🏫 {hw.teacherName}</span>
            {hw.fileUrl && (
              <button
                onClick={() => downloadFile(hw.fileUrl, hw.fileName)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#6366f1", fontWeight: 700, fontFamily: "inherit" }}
              >📎 Download</button>
            )}
          </div>

          {submission && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 10,
              padding: "8px 12px", background: "#f0fdf4", borderRadius: 12,
              fontSize: 13, color: "#059669", fontWeight: 700,
            }}>
              <Star size={12} style={{ flexShrink: 0 }} />
              {submission.bringPhysically ? "📚 Bringing physically" : submission.note || "File uploaded"}
              {submission.fileUrl && (
                <button
                  onClick={() => downloadFile(submission.fileUrl, submission.fileName || "submission")}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#6366f1", marginLeft: 8, fontFamily: "inherit", fontSize: "inherit", fontWeight: 700 }}
                >📎 View</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



function subjectBanner(subject, type) {
  const isGame = type === "game";
  const sub = isGame
    ? { color: "#ec4899", colorEnd: "#f59e0b" }
    : { color: (SUBJECT_CONFIG[subject] || DEFAULT_SUB).color, colorEnd: (SUBJECT_CONFIG[subject] || DEFAULT_SUB).color + "cc" };
  return {
    display: "flex", alignItems: "center", gap: 14,
    background: isGame
      ? "linear-gradient(135deg, #f59e0b, #ec4899)"
      : `linear-gradient(135deg, ${sub.color}, ${sub.colorEnd})`,
    borderRadius: 14, padding: "16px 18px", marginBottom: 16,
  };
}

const closeBtn = {
  background: "#f3f4f6", border: "none", borderRadius: 10,
  padding: 7, cursor: "pointer", display: "flex", alignItems: "center", color: "#374151",
};
