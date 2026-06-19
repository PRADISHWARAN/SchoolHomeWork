import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { CheckCircle, FileText, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { downloadFile } from "../utils/downloadFile";

export default function Submissions() {
  const { userProfile } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [homework,    setHomework]    = useState([]);
  const [students,    setStudents]    = useState([]);
  const [selectedHwId, setSelectedHwId] = useState("all");
  const [activeTab,    setActiveTab]    = useState("submitted"); // "submitted" | "not_submitted"
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    /* ── Teacher subject scope ── */
    const teacherSubjects = userProfile?.subjects || ["ALL"];
    const isAllSubjects   = teacherSubjects.includes("ALL") || teacherSubjects.length === 0;

    try {
      // 1. Homework that actually exists for this class
      const hwSnap = await getDocs(
        query(collection(db, "homework"), where("classId", "==", userProfile.classId))
      );
      let hw = hwSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      /* Filter to teacher's subjects only */
      if (!isAllSubjects) {
        hw = hw.filter((h) =>
          h.type === "game"
            ? h.teacherId === userProfile.uid
            : teacherSubjects.includes(h.subject)
        );
      }

      hw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHomework(hw);

      // 2. All submissions for this class
      const subSnap = await getDocs(
        query(collection(db, "submissions"), where("classId", "==", userProfile.classId))
      );
      const allSubs = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ✅ Only keep submissions whose homework still exists in the homework collection
      // This removes orphaned / leftover test submissions
      const validHwIds = new Set(hw.map((h) => h.id));
      const subs = allSubs.filter((s) => validHwIds.has(s.homeworkId));
      subs.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setSubmissions(subs);

      // 3. All students in this class
      const stuSnap = await getDocs(
        query(
          collection(db, "users"),
          where("role",    "==", "student"),
          where("classId", "==", userProfile.classId)
        )
      );
      const stus = stuSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      stus.sort((a, b) => a.name?.localeCompare(b.name));
      setStudents(stus);
    } catch {
      toast.error("Failed to load submissions");
    }
    setLoading(false);
  }

  /* ── Derived data ── */
  const filteredSubs = selectedHwId === "all"
    ? submissions
    : submissions.filter((s) => s.homeworkId === selectedHwId);

  const submittedIds      = new Set(filteredSubs.map((s) => s.studentId));
  const notSubmitted      = selectedHwId === "all" ? [] : students.filter((s) => !submittedIds.has(s.id));
  const selectedHw        = homework.find((h) => h.id === selectedHwId);
  const pct               = students.length > 0
    ? Math.round((filteredSubs.length / students.length) * 100)
    : 0;

  if (loading) return <div className="loader"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Student Submissions</h1>
          <p>Class {userProfile?.classId} · {students.length} students · {submissions.length} total submissions</p>
        </div>
      </div>

      {/* ── Homework selector ── */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>📋 Select Homework to Track</label>
          <select
            value={selectedHwId}
            onChange={(e) => { setSelectedHwId(e.target.value); setActiveTab("submitted"); }}
          >
            <option value="all">— All Submissions (overview) —</option>
            {homework.map((hw) => (
              <option key={hw.id} value={hw.id}>
                {hw.title}{hw.subject && hw.subject !== "—" ? ` (${hw.subject})` : ""}{hw.createdAt?.seconds ? ` · Posted: ${new Date(hw.createdAt.seconds * 1000).toLocaleDateString()}` : ""}{hw.dueDate ? ` · Due: ${hw.dueDate}${hw.dueTime ? ` ${new Date(`2000-01-01T${hw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SPECIFIC HOMEWORK SELECTED → Tracker View
      ════════════════════════════════════════════════════════ */}
      {selectedHwId !== "all" && selectedHw && (
        <>
          {/* Stats banner */}
          <div style={{
            background: "linear-gradient(135deg, #312e81 0%, #6366f1 60%, #8b5cf6 100%)",
            borderRadius: 22, padding: "22px 26px", marginBottom: 20,
            boxShadow: "0 8px 32px rgba(99,102,241,0.3)",
          }}>
            {/* Homework name + meta */}
            <div style={{
              fontFamily: "'Fredoka One', cursive", fontSize: 22,
              color: "white", marginBottom: 2,
            }}>
              📋 {selectedHw.title}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 18 }}>
              {selectedHw.subject || "—"} &nbsp;·&nbsp; Due: {selectedHw.dueDate || "—"}{selectedHw.dueTime ? ` ${new Date(`2000-01-01T${selectedHw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""} &nbsp;·&nbsp; 👩‍🏫 {selectedHw.teacherName || "—"}
            </div>

            {/* Stat pills */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <StatPill emoji="✅" count={filteredSubs.length}     label="Submitted"     pillBg="rgba(16,185,129,0.25)"  numColor="#6ee7b7" />
              <StatPill emoji="❌" count={notSubmitted.length}     label="Not Submitted" pillBg="rgba(239,68,68,0.25)"   numColor="#fca5a5" />
              <StatPill emoji="👥" count={students.length}         label="Total Students" pillBg="rgba(253,230,138,0.2)" numColor="#fde68a" />
            </div>

            {/* Progress bar */}
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 7 }}>
              {filteredSubs.length} of {students.length} students submitted &nbsp;·&nbsp; <strong style={{ color: "#6ee7b7" }}>{pct}%</strong>
            </div>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 50, height: 12, overflow: "hidden" }}>
              <div style={{
                background: pct === 100
                  ? "linear-gradient(90deg,#10b981,#34d399)"
                  : "linear-gradient(90deg,#6ee7b7,#34d399)",
                borderRadius: 50, height: "100%",
                width: `${pct}%`,
                transition: "width 0.9s ease",
                minWidth: pct > 0 ? 12 : 0,
              }} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <TabBtn
              active={activeTab === "submitted"}
              onClick={() => setActiveTab("submitted")}
              label={`✅ Submitted (${filteredSubs.length})`}
              activeColor="#10b981"
              activeBg="linear-gradient(135deg,#10b981,#059669)"
            />
            <TabBtn
              active={activeTab === "not_submitted"}
              onClick={() => setActiveTab("not_submitted")}
              label={`❌ Not Submitted (${notSubmitted.length})`}
              activeColor="#ef4444"
              activeBg="linear-gradient(135deg,#ef4444,#dc2626)"
            />
          </div>

          {/* ── SUBMITTED tab ── */}
          {activeTab === "submitted" && (
            filteredSubs.length === 0 ? (
              <div className="card empty-state">
                <Clock size={52} color="#9ca3af" />
                <h3>No submissions yet</h3>
                <p>No student has submitted this homework yet. Check back later!</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="sub-table-scroll">
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Student</th>
                      <th style={styles.th}>Submission</th>
                      <th style={styles.th}>Submitted At</th>
                      <th style={styles.th}>File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map((sub, i) => (
                      <tr key={sub.id} style={styles.tr}>
                        <td style={{ ...styles.td, color: "#9ca3af", fontSize: 13, width: 40 }}>{i + 1}</td>
                        <td style={styles.td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: "50%",
                              background: "#d1fae5", color: "#059669",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 800, fontSize: 15, flexShrink: 0,
                            }}>
                              {sub.studentName?.[0]?.toUpperCase() || "S"}
                            </div>
                            <div style={{ fontWeight: 700 }}>{sub.studentName}</div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          {sub.bringPhysically ? (
                            <span className="badge badge-yellow">📚 Bringing physically</span>
                          ) : (
                            <span style={{ fontSize: 13, color: "#6b7280" }}>{sub.note || "File only"}</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {sub.submittedAt?.seconds
                              ? new Date(sub.submittedAt.seconds * 1000).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {sub.fileUrl ? (
                            <button
                              onClick={() => downloadFile(sub.fileUrl, sub.fileName || "submission")}
                              style={{ ...styles.fileLink, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <FileText size={14} /> Download
                            </button>
                          ) : (
                            <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )
          )}

          {/* ── NOT SUBMITTED tab ── */}
          {activeTab === "not_submitted" && (
            notSubmitted.length === 0 ? (
              <div className="card empty-state" style={{
                background: "linear-gradient(135deg,#f0fdf4,#d1fae5)",
                border: "2px solid #6ee7b7",
              }}>
                <CheckCircle size={56} color="#10b981" />
                <h3 style={{ color: "#059669" }}>All students submitted! 🎉</h3>
                <p>Every student in Class {userProfile?.classId} has submitted this homework. Great class!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Quick header count */}
                <div style={{
                  background: "#fff5f5", border: "1.5px solid #fecaca",
                  borderRadius: 14, padding: "12px 18px",
                  fontSize: 14, color: "#dc2626", fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  ⚠️ {notSubmitted.length} student{notSubmitted.length > 1 ? "s" : ""} yet to submit — follow up with them!
                </div>

                {notSubmitted.map((stu) => (
                  <div key={stu.id} style={{
                    background: "white", borderRadius: 14,
                    border: "1.5px solid #fee2e2",
                    padding: "14px 18px",
                    display: "flex", alignItems: "center", gap: 14,
                    boxShadow: "0 2px 8px rgba(239,68,68,0.06)",
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "#fee2e2", color: "#ef4444",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 18, flexShrink: 0,
                    }}>
                      {stu.name?.[0]?.toUpperCase() || "S"}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{stu.name}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                        {stu.phone ? `📱 ${stu.phone}` : stu.email || ""}
                        &nbsp;·&nbsp; Class {stu.classId}
                      </div>
                    </div>

                    {/* Badge */}
                    <span style={{
                      background: "#fee2e2", color: "#ef4444",
                      fontWeight: 700, fontSize: 12,
                      padding: "5px 14px", borderRadius: 50,
                      whiteSpace: "nowrap",
                    }}>
                      ⏳ Not Submitted
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ALL SUBMISSIONS selected → original overview table
      ════════════════════════════════════════════════════════ */}
      {selectedHwId === "all" && (
        <>
          {/* Quick summary pills */}
          {submissions.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <SummaryPill bg="#d1fae5" color="#059669" label={`${submissions.length} total submissions`} />
              <SummaryPill bg="#e0e7ff" color="#4f46e5" label={`${students.length} students in class`} />
            </div>
          )}

          {submissions.length === 0 ? (
            <div className="card empty-state">
              <CheckCircle size={52} />
              <h3>No submissions yet</h3>
              <p>Select a specific homework above to see who submitted and who didn't!</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={styles.th}>Student Name</th>
                    <th style={styles.th}>Homework</th>
                    <th style={styles.th}>Submission</th>
                    <th style={styles.th}>Submitted At</th>
                    <th style={styles.th}>File</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "#e0e7ff", color: "#4f46e5",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: 14, flexShrink: 0,
                          }}>
                            {sub.studentName?.[0]?.toUpperCase() || "S"}
                          </div>
                          <div style={{ fontWeight: 700 }}>{sub.studentName}</div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontSize: 13 }}>{sub.homeworkTitle}</div>
                      </td>
                      <td style={styles.td}>
                        {sub.bringPhysically ? (
                          <span className="badge badge-yellow">📚 Bringing physically</span>
                        ) : (
                          <span style={{ fontSize: 13, color: "#6b7280" }}>{sub.note || "File only"}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {sub.submittedAt?.seconds
                            ? new Date(sub.submittedAt.seconds * 1000).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {sub.fileUrl ? (
                          <button
                            onClick={() => downloadFile(sub.fileUrl, sub.fileName || "submission")}
                            style={{ ...styles.fileLink, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <FileText size={14} /> Download
                          </button>
                        ) : (
                          <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Small helper components ─────────────────────────────── */
function StatPill({ emoji, count, label, pillBg, numColor }) {
  return (
    <div style={{
      background: pillBg, borderRadius: 50,
      padding: "7px 18px",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ fontWeight: 900, fontSize: 22, color: numColor, fontFamily: "'Nunito',sans-serif" }}>{count}</span>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "'Poppins',sans-serif" }}>{label}</span>
    </div>
  );
}

function TabBtn({ active, onClick, label, activeColor, activeBg }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "11px 22px", borderRadius: 50,
        border: `2px solid ${active ? activeColor : "#e0e7ff"}`,
        background: active ? activeBg : "white",
        color: active ? "white" : "#6b7280",
        cursor: "pointer", fontFamily: "'Poppins', sans-serif",
        fontSize: 13, fontWeight: 700,
        transition: "all 0.2s",
        boxShadow: active ? `0 4px 14px ${activeColor}40` : "none",
      }}
    >
      {label}
    </button>
  );
}

function SummaryPill({ bg, color, label }) {
  return (
    <span style={{
      background: bg, color, fontWeight: 700, fontSize: 13,
      padding: "5px 14px", borderRadius: 50,
    }}>
      {label}
    </span>
  );
}

/* ── Styles ──────────────────────────────────────────────── */
const styles = {
  table:  { width: "100%", borderCollapse: "collapse" },
  thead:  { background: "#f5f7ff" },
  th: {
    padding: "12px 20px", textAlign: "left", fontSize: 12,
    fontWeight: 700, color: "#6b7280", textTransform: "uppercase",
    letterSpacing: "0.05em", borderBottom: "1.5px solid #e0e7ff",
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "14px 20px", verticalAlign: "middle" },
  fileLink: {
    display: "inline-flex", alignItems: "center", gap: 4,
    color: "#4f46e5", fontWeight: 600, fontSize: 13, textDecoration: "none",
  },
};
