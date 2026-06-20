import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, FileUp, X, BookOpen, Gamepad2, ExternalLink, Calendar, List } from "lucide-react";
import toast from "react-hot-toast";
import HomeworkCalendar from "../components/HomeworkCalendar";
import { downloadFile } from "../utils/downloadFile";

const PLATFORMS = [
  { id: "Scratch",       emoji: "🐱", label: "Scratch"       },
  { id: "Kahoot",        emoji: "🎯", label: "Kahoot"        },
  { id: "Quizlet",       emoji: "🃏", label: "Quizlet"       },
  { id: "Google Forms",  emoji: "📝", label: "Google Forms"  },
  { id: "Other",         emoji: "🎮", label: "Other"         },
];

const SUBJECTS = ["Mathematics","English","Science","Social Studies","Hindi","Tamil","Computer","Drawing","EVS","General Knowledge"];

export default function PostHomework() {
  const { userProfile, currentUser } = useAuth();
  const [homeworkList, setHomeworkList]   = useState([]);
  const [showModal, setShowModal]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [viewMode, setViewMode]           = useState("list");       // "list" | "calendar"
  const [submissionsMap, setSubmissionsMap] = useState({});          // { hwId: count }
  const [totalStudents, setTotalStudents]   = useState(0);

  /* ── Subject scope for this teacher ── */
  const teacherSubjects  = userProfile?.subjects || ["ALL"];
  const isAllSubjects    = teacherSubjects.includes("ALL") || teacherSubjects.length === 0;
  const availableSubjects = isAllSubjects
    ? SUBJECTS
    : SUBJECTS.filter((s) => teacherSubjects.includes(s));

  const emptyForm = {
    type: "homework",
    title: "", subject: "", description: "", dueDate: "", dueTime: "", file: null,
    gameUrl: "", gamePlatform: "Other",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchHomework(); }, []);

  async function fetchHomework() {
    setLoading(true);
    try {
      const q = query(collection(db, "homework"), where("classId", "==", userProfile.classId));
      const snap = await getDocs(q);
      let hw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      /* Filter to teacher's subjects only (non-ALL teachers) */
      if (!isAllSubjects) {
        hw = hw.filter((h) =>
          h.type === "game"
            ? h.teacherId === currentUser.uid  // games: only own
            : teacherSubjects.includes(h.subject)
        );
      }

      hw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHomeworkList(hw);

      /* ── Submissions map: { hwId → count } ── */
      const subSnap = await getDocs(
        query(collection(db, "submissions"), where("classId", "==", userProfile.classId))
      );
      const smap = {};
      subSnap.docs.forEach(d => {
        const hwId = d.data().homeworkId;
        if (hwId) smap[hwId] = (smap[hwId] || 0) + 1;
      });
      setSubmissionsMap(smap);

      /* ── Total students in class ── */
      const stuSnap = await getDocs(
        query(collection(db, "users"),
          where("role",    "==", "student"),
          where("classId", "==", userProfile.classId)
        )
      );
      setTotalStudents(stuSnap.size);

    } catch { toast.error("Failed to load"); }
    setLoading(false);
  }

  async function handlePost() {
    if (!form.title || !form.description || !form.dueDate) {
      toast.error("Please fill all required fields");
      return;
    }
    if (form.type === "homework" && !form.subject) {
      toast.error("Please select a subject");
      return;
    }
    if (form.type === "game" && !form.gameUrl.trim()) {
      toast.error("Please enter the game URL or link");
      return;
    }

    setUploading(true);
    try {
      let fileUrl = null, fileName = null;
      if (form.file) {
        const fileRef = ref(storage, `homework/${userProfile.classId}/${Date.now()}_${form.file.name}`);
        await uploadBytes(fileRef, form.file);
        fileUrl = await getDownloadURL(fileRef);
        fileName = form.file.name;
      }

      await addDoc(collection(db, "homework"), {
        type: form.type,
        title: form.title,
        subject: form.type === "game" ? (form.subject || "Game") : form.subject,
        description: form.description,
        dueDate: form.dueDate,
        dueTime: form.dueTime || null,
        classId: userProfile.classId,
        teacherId: currentUser.uid,
        teacherName: userProfile.name,
        fileUrl,
        fileName,
        gameUrl:      form.type === "game" ? form.gameUrl.trim() : null,
        gamePlatform: form.type === "game" ? form.gamePlatform : null,
        createdAt: serverTimestamp(),
      });

      const label = form.type === "game" ? "Game challenge posted! 🎮" : "Homework posted! 📚";
      toast.success(label);
      setForm(emptyForm);
      setShowModal(false);
      fetchHomework();
    } catch (e) {
      console.error(e);
      toast.error("Failed: " + (e.code || e.message));
    }
    setUploading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this homework? All student submissions for it will also be removed.")) return;
    try {
      const subSnap = await getDocs(query(collection(db, "submissions"), where("homeworkId", "==", id)));
      const batch = writeBatch(db);
      subSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, "homework", id));
      await batch.commit();
      toast.success("Deleted");
      fetchHomework();
    } catch { toast.error("Failed to delete"); }
  }

  const homeworkItems = homeworkList.filter(h => h.type !== "game");
  const gameItems     = homeworkList.filter(h => h.type === "game");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Class {userProfile?.classId} — Assignments</h1>
          <p>Post homework and game challenges for your students</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* View toggle */}
          <div style={{
            display: "flex", background: "#f0f4ff",
            borderRadius: 12, padding: 4, gap: 4,
          }}>
            <button
              onClick={() => setViewMode("list")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9, border: "none",
                background: viewMode === "list"
                  ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
                color: viewMode === "list" ? "white" : "#6b7280",
                cursor: "pointer", fontFamily: "'Poppins',sans-serif",
                fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              }}
            >
              <List size={15} /> List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9, border: "none",
                background: viewMode === "calendar"
                  ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
                color: viewMode === "calendar" ? "white" : "#6b7280",
                cursor: "pointer", fontFamily: "'Poppins',sans-serif",
                fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              }}
            >
              <Calendar size={15} /> Calendar
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ fontSize: 15 }}>
            <Plus size={18} /> Post New
          </button>
        </div>
      </div>

      {/* ── Calendar view ── */}
      {viewMode === "calendar" && !loading && (
        <div className="card" style={{ padding: "24px 20px" }}>
          <HomeworkCalendar
            homeworkList={homeworkList}
            submissionsMap={submissionsMap}
            totalStudents={totalStudents}
            showClass={false}
          />
        </div>
      )}

      {loading ? (
        <div className="loader"><div className="spinner" /><span>Loading...</span></div>
      ) : viewMode === "calendar" ? null : (
        <>
          {/* Game Challenges */}
          {gameItems.length > 0 && (
            <div>
              <h2 style={{ fontSize: 18, fontFamily: "'Nunito', sans-serif", marginBottom: 14, color: "#d97706", display: "flex", alignItems: "center", gap: 8 }}>
                🎮 Game Challenges ({gameItems.length})
              </h2>
              {gameItems.map(hw => <HomeworkCard key={hw.id} hw={hw} onDelete={() => handleDelete(hw.id)} />)}
            </div>
          )}

          {/* Regular Homework */}
          {homeworkItems.length > 0 && (
            <div style={{ marginTop: gameItems.length > 0 ? 24 : 0 }}>
              <h2 style={{ fontSize: 18, fontFamily: "'Nunito', sans-serif", marginBottom: 14, color: "#4338ca", display: "flex", alignItems: "center", gap: 8 }}>
                📚 Homework ({homeworkItems.length})
              </h2>
              {homeworkItems.map(hw => <HomeworkCard key={hw.id} hw={hw} onDelete={() => handleDelete(hw.id)} />)}
            </div>
          )}

          {homeworkList.length === 0 && (
            <div className="card empty-state">
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎒</div>
              <h3>Nothing posted yet</h3>
              <p>Click "Post New" to add homework or a fun game challenge!</p>
            </div>
          )}
        </>
      )}

      {/* Post Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {form.type === "game" ? "🎮 Post Game Challenge" : "📚 Post Homework"}
              </h2>
              <button onClick={() => setShowModal(false)} style={closeBtn}><X size={18} /></button>
            </div>

            {/* Type Toggle */}
            <div className="type-tabs">
              <button
                className={`type-tab type-tab-hw ${form.type === "homework" ? "active" : ""}`}
                onClick={() => setForm({ ...form, type: "homework" })}
              >
                📚 Homework
              </button>
              <button
                className={`type-tab type-tab-game ${form.type === "game" ? "active" : ""}`}
                onClick={() => setForm({ ...form, type: "game" })}
              >
                🎮 Game Challenge
              </button>
            </div>

            {/* Game-specific fields */}
            {form.type === "game" && (
              <>
                <div style={gameInfoBox}>
                  🎯 Paste a link to a game on Scratch, Kahoot, Quizlet, Google Forms, or any website. Students will click PLAY to open it!
                </div>

                <div className="form-group">
                  <label>Platform</label>
                  <div className="platform-grid">
                    {PLATFORMS.map(p => (
                      <button
                        key={p.id}
                        className={`platform-btn ${form.gamePlatform === p.id ? "selected" : ""}`}
                        onClick={() => setForm({ ...form, gamePlatform: p.id })}
                        type="button"
                      >
                        {p.emoji} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Game URL / Link *</label>
                  <input
                    type="url"
                    placeholder="https://scratch.mit.edu/projects/... or Kahoot link"
                    value={form.gameUrl}
                    onChange={e => setForm({ ...form, gameUrl: e.target.value })}
                  />
                  {form.gameUrl && (
                    <a href={form.gameUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: "#6366f1", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                      <ExternalLink size={12} /> Test this link
                    </a>
                  )}
                </div>
              </>
            )}

            <div className="form-group">
              <label>{form.type === "game" ? "Game Title *" : "Homework Title *"}</label>
              <input
                type="text"
                placeholder={form.type === "game" ? "e.g. Times Tables Adventure" : "e.g. Chapter 3 Exercise"}
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>

            {form.type === "homework" && (
              <div className="form-group">
                <label>Subject *</label>
                <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                  <option value="">Select Subject</option>
                  {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {!isAllSubjects && (
                  <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "block" }}>
                    📚 Showing only your assigned subjects
                  </span>
                )}
              </div>
            )}

            {form.type === "game" && (
              <div className="form-group">
                <label>Subject (Optional)</label>
                <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                  <option value="">— Not related to a subject —</option>
                  {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>{form.type === "game" ? "Instructions for Students *" : "Description / Instructions *"}</label>
              <textarea
                placeholder={form.type === "game"
                  ? "Describe the game and what students need to do..."
                  : "Describe what students need to do..."}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Due Date & Time *</label>
              <div className="due-datetime-row">
                <input
                  type="date"
                  value={form.dueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  style={{ flex: 1 }}
                />
                <input
                  type="time"
                  value={form.dueTime}
                  onChange={e => setForm({ ...form, dueTime: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Attach File (Optional{form.type === "game" ? " — for extra materials" : ""})</label>
              <div className="file-upload-area" onClick={() => document.getElementById("hw-file").click()}>
                <FileUp size={24} color="#6366f1" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 14, color: "#6366f1", fontWeight: 700 }}>
                  {form.file ? form.file.name : "Click to upload PDF or Image"}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>PDF, JPG, PNG up to 10MB</div>
              </div>
              <input id="hw-file" type="file" accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }} onChange={e => setForm({ ...form, file: e.target.files[0] })} />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePost}
                disabled={uploading}
                style={{ flex: 2, justifyContent: "center", background: form.type === "game" ? "linear-gradient(135deg, #f59e0b, #ec4899)" : undefined }}
              >
                {uploading
                  ? "Posting... 🚀"
                  : form.type === "game"
                    ? "🎮 Post Game Challenge!"
                    : "📚 Post Homework"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ hw, onDelete }) {
  const dueDate = hw.dueDate
    ? new Date(hw.dueDate + (hw.dueTime ? `T${hw.dueTime}` : "T23:59"))
    : null;
  const isOverdue = dueDate && dueDate < new Date();
  const isGame = hw.type === "game";
  const platform = hw.gamePlatform || "Other";

  return (
    <div className="homework-card" style={{ borderColor: isGame ? "#fde68a" : undefined }}>
      <div className="homework-card-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{isGame ? "🎮" : "📝"}</span>
            <div className="homework-card-title">{hw.title}</div>
          </div>
          <div className="homework-card-meta">
            {isGame
              ? <span className="badge badge-game">🎮 {platform}</span>
              : <span className="badge badge-blue">{hw.subject}</span>}
            <span className="badge badge-green">Class {hw.classId}</span>
            {isOverdue && <span className="badge badge-red">Overdue</span>}
          </div>
        </div>
        <button className="btn btn-danger" onClick={onDelete} style={{ padding: "6px 12px", fontSize: 13 }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <div className="homework-card-desc">{hw.description}</div>

      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", fontSize: 13, color: "#6b7280", alignItems: "center" }}>
        <span>📅 Due: {dueDate?.toLocaleDateString() || "No date"}{hw.dueTime && ` · ⏰ ${new Date(`2000-01-01T${hw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span>
        <span>👩‍🏫 {hw.teacherName}</span>
        {isGame && hw.gameUrl && (
          <a href={hw.gameUrl} target="_blank" rel="noreferrer"
            style={{ color: "#f59e0b", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
            ▶ Open Game
          </a>
        )}
        {hw.fileUrl && (
          <button
            onClick={() => downloadFile(hw.fileUrl, hw.fileName)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#6366f1", fontWeight: 700, fontFamily: "inherit", fontSize: "inherit" }}
          >
            📎 {hw.fileName}
          </button>
        )}
      </div>
    </div>
  );
}

const closeBtn = {
  background: "#f3f4f6", border: "none", borderRadius: 10,
  padding: 7, cursor: "pointer", display: "flex", alignItems: "center", color: "#374151",
};

const gameInfoBox = {
  background: "linear-gradient(135deg, #fff7ed, #fce7f3)",
  border: "1.5px solid #fde68a",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 13,
  color: "#92400e",
  marginBottom: 16,
  fontWeight: 600,
};
