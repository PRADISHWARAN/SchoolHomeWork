import React, { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { BookOpen, Trash2, Calendar, List } from "lucide-react";
import toast from "react-hot-toast";
import HomeworkCalendar from "../components/HomeworkCalendar";
import { downloadFile } from "../utils/downloadFile";

const CLASSES = ["Pre-KG-A", "Pre-KG-B", "LKG-A", "LKG-B", "UKG-A", "UKG-B", "1st-A", "1st-B", "2nd-A", "2nd-B", "3rd-A", "3rd-B", "4th-A", "4th-B", "5th-A", "5th-B", "6th-A", "6th-B", "7th-A", "7th-B", "8th-A", "8th-B", "9th-A", "9th-B", "10th-A", "10th-B"];

export default function AllHomework() {
  const [homeworkList, setHomeworkList]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState("LKG-A");
  const [viewMode, setViewMode]           = useState("list");   // "list" | "calendar"
  const [submissionsMap, setSubmissionsMap] = useState({});       // { hwId: count }
  const [classStudentCounts, setClassStudentCounts] = useState({}); // { classId: count }

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      /* 1. All homework */
      const snap = await getDocs(collection(db, "homework"));
      const hw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      hw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHomeworkList(hw);

      /* 2. Submissions map: { hwId → count } */
      const subSnap = await getDocs(collection(db, "submissions"));
      const smap = {};
      subSnap.docs.forEach(d => {
        const hwId = d.data().homeworkId;
        if (hwId) smap[hwId] = (smap[hwId] || 0) + 1;
      });
      setSubmissionsMap(smap);

      /* 3. Student counts per class: { classId → count } */
      const stuSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "student"))
      );
      const counts = {};
      stuSnap.docs.forEach(d => {
        const cid = d.data().classId;
        if (cid) counts[cid] = (counts[cid] || 0) + 1;
      });
      setClassStudentCounts(counts);

    } catch {
      toast.error("Failed to load");
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this homework?")) return;
    try {
      await deleteDoc(doc(db, "homework", id));
      toast.success("Deleted");
      fetchAll();
    } catch { toast.error("Failed"); }
  }

  const filtered = homeworkList.filter((h) => h.classId === filter);

  if (loading) return <div className="loader"><div className="spinner" /><span>Loading...</span></div>;

  /* For calendar: when a specific class is selected, pass that student count */
  const calTotalStudents = classStudentCounts[filter] || 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>All Homework</h1>
          <p>{homeworkList.length} total assignments across all classes</p>
        </div>
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
      </div>

      {/* Class filter — shown above the list only */}
      {viewMode === "list" && (
        <div className="class-filter-scroll">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: "6px 16px", borderRadius: 50, border: "1.5px solid #e0e7ff",
                background: filter === c ? "#4f46e5" : "white",
                color: filter === c ? "white" : "#6b7280",
                cursor: "pointer", fontFamily: "'Poppins', sans-serif",
                fontSize: 13, fontWeight: 600,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Calendar view ── */}
      {viewMode === "calendar" && (
        <div className="card" style={{ padding: "24px 20px", marginBottom: 20 }}>

          {/* Class filter — embedded inside the calendar card */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#6b7280",
              marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              🏫 Filter by Class
            </div>
            <div className="class-filter-scroll">
              {CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  style={{
                    padding: "6px 16px", borderRadius: 50,
                    border: `1.5px solid ${filter === c ? "#4f46e5" : "#e0e7ff"}`,
                    background: filter === c
                      ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                      : "white",
                    color: filter === c ? "white" : "#6b7280",
                    cursor: "pointer", fontFamily: "'Poppins', sans-serif",
                    fontSize: 13, fontWeight: 600,
                    boxShadow: filter === c ? "0 4px 10px rgba(99,102,241,0.3)" : "none",
                    transition: "all 0.18s",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Status line */}
          <div style={{
            marginBottom: 16, fontSize: 13, color: "#6b7280",
            background: "#f8faff", borderRadius: 10, padding: "10px 14px",
            border: "1px solid #e0e7ff",
          }}>
            {`📋 Class ${filter} · ${calTotalStudents} students enrolled`}
          </div>

          <HomeworkCalendar
            homeworkList={filtered}
            submissionsMap={submissionsMap}
            totalStudents={calTotalStudents}
            showClass={false}
          />
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === "list" && (filtered.length === 0 ? (
        <div className="card empty-state">
          <BookOpen size={52} />
          <h3>No homework found</h3>
        </div>
      ) : (
        filtered.map((hw) => {
          const dueDate = hw.dueDate
            ? new Date(hw.dueDate + (hw.dueTime ? `T${hw.dueTime}` : "T23:59"))
            : null;
          const isOverdue = dueDate && dueDate < new Date();
          return (
            <div key={hw.id} className="homework-card">
              <div className="homework-card-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{hw.type === "game" ? "🎮" : "📝"}</span>
                    <div className="homework-card-title">{hw.title}</div>
                  </div>
                  <div className="homework-card-meta">
                    {hw.type === "game"
                      ? <span className="badge badge-game">🎮 {hw.gamePlatform || "Game"}</span>
                      : <span className="badge badge-blue">{hw.subject}</span>}
                    <span className="badge badge-green">Class {hw.classId}</span>
                    {isOverdue && <span className="badge badge-red">Overdue</span>}
                  </div>
                </div>
                <button className="btn btn-danger" onClick={() => handleDelete(hw.id)} style={{ padding: "6px 12px", fontSize: 13 }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
              <div className="homework-card-desc">{hw.description}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "#6b7280", flexWrap: "wrap" }}>
                <span>📅 Due: {dueDate?.toLocaleDateString() || "—"}{hw.dueTime && ` · ⏰ ${new Date(`2000-01-01T${hw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span>
                <span>👩‍🏫 {hw.teacherName}</span>
                {hw.type === "game" && hw.gameUrl && (
                  <a href={hw.gameUrl} target="_blank" rel="noreferrer" style={{ color: "#f59e0b", fontWeight: 700 }}>
                    ▶ Open Game
                  </a>
                )}
                {hw.fileUrl && (
                  <button
                    onClick={() => downloadFile(hw.fileUrl, hw.fileName)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#6366f1", fontWeight: 600, fontFamily: "inherit", fontSize: "inherit" }}
                  >
                    📎 {hw.fileName}
                  </button>
                )}
              </div>
            </div>
          );
        })
      ))}
    </div>
  );
}
