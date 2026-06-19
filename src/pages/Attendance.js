import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import {
  collection, query, where, getDocs,
  doc, setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { Download, CheckCircle, XCircle, CalendarDays, RefreshCw, School } from "lucide-react";

const CLASSES = ["Pre-KG-A","Pre-KG-B","LKG-A","LKG-B","UKG-A","UKG-B","1st-A","1st-B","2nd-A","2nd-B","3rd-A","3rd-B","4th-A","4th-B","5th-A","5th-B","6th-A","6th-B","7th-A","7th-B","8th-A","8th-B","9th-A","9th-B","10th-A","10th-B"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
}

function fmtDateShort(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function AvatarCircle({ name, gender, size = 38 }) {
  const colors =
    gender === "Female" ? { bg: "#fce7f3", color: "#be185d" } :
    gender === "Male"   ? { bg: "#e0e7ff", color: "#4f46e5" } :
                          { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: colors.bg, color: colors.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.42, flexShrink: 0,
      fontFamily: "'Fredoka One', cursive",
    }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function StatCard({ emoji, label, value, color, bg }) {
  return (
    <div style={{
      flex: 1, minWidth: 100,
      background: bg, border: `2px solid ${color}30`,
      borderRadius: 18, padding: "16px 14px",
      textAlign: "center",
      boxShadow: `0 4px 16px ${color}15`,
    }}>
      <div style={{ fontSize: 26, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'Fredoka One', cursive" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ── Percentage ring ─────────────────────────────────────── */
function PctRing({ pct, size = 52 }) {
  const r   = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
      <text
        x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg) translate(0px, -${size}px)`, transformOrigin: `${size/2}px ${size/2}px` }}
        fill={color} fontSize={11} fontWeight={800} fontFamily="'Poppins',sans-serif"
      >
        {pct}%
      </text>
    </svg>
  );
}

export default function Attendance() {
  const { userProfile, currentUser } = useAuth();
  const role    = userProfile?.role;
  const classId = userProfile?.classId;

  const [tab, setTab] = useState(role === "admin" ? "overview" : "take");

  /* ── Take Attendance ─────────────────────────────────────── */
  const [students,        setStudents]        = useState([]);
  const [attendance,      setAttendance]      = useState({});
  const [todayRecord,     setTodayRecord]     = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [submitting,      setSubmitting]      = useState(false);
  const [editMode,        setEditMode]        = useState(false);

  useEffect(() => {
    if (role !== "teacher") { setLoadingStudents(false); return; }
    (async () => {
      setLoadingStudents(true);
      try {
        const q    = query(collection(db,"users"), where("role","==","student"), where("classId","==",classId));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name));
        setStudents(list);
        const init = {};
        list.forEach(s => { init[s.uid] = "present"; });
        setAttendance(init);
      } catch { toast.error("Could not load students"); }
      setLoadingStudents(false);
    })();
  }, [classId, role]);

  useEffect(() => {
    if (role !== "teacher") return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "attendance", `${classId}_${todayStr()}`));
        if (snap.exists()) {
          const data = snap.data();
          setTodayRecord(data);
          const existing = {};
          data.records.forEach(r => { existing[r.uid] = r.status; });
          setAttendance(existing);
        }
      } catch {}
    })();
  }, [classId, role]);

  const toggleStudent = (uid) =>
    setAttendance(prev => ({ ...prev, [uid]: prev[uid] === "present" ? "absent" : "present" }));

  const markAll = (status) => {
    const next = {};
    students.forEach(s => { next[s.uid] = status; });
    setAttendance(next);
  };

  const handleSubmit = async () => {
    if (!students.length) { toast.error("No students found in this class!"); return; }
    setSubmitting(true);
    try {
      const today   = todayStr();
      const records = students.map(s => ({
        uid:    s.uid,
        name:   s.name,
        gender: s.gender || "",
        status: attendance[s.uid] || "present",
      }));
      const totalPresent = records.filter(r => r.status === "present").length;
      const totalAbsent  = records.length - totalPresent;
      const payload = {
        classId,
        date: today,
        takenBy:     currentUser.uid,
        takenByName: userProfile.name,
        takenAt:     serverTimestamp(),
        records,
        totalStudents: records.length,
        totalPresent,
        totalAbsent,
      };
      await setDoc(doc(db, "attendance", `${classId}_${today}`), payload);
      setTodayRecord({ ...payload, takenAt: new Date() });
      setEditMode(false);
      toast.success(`✅ Attendance saved! ${totalPresent} present · ${totalAbsent} absent`);
    } catch { toast.error("Failed to save attendance. Try again."); }
    setSubmitting(false);
  };

  /* ── Overview (admin) ────────────────────────────────────── */
  const [overviewDate,    setOverviewDate]    = useState(todayStr());
  const [overviewData,    setOverviewData]    = useState([]);   // array of { classId, data|null }
  const [loadingOverview, setLoadingOverview] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!overviewDate) return;
    setLoadingOverview(true);
    try {
      const results = await Promise.all(
        CLASSES.map(async (cls) => {
          const snap = await getDoc(doc(db, "attendance", `${cls}_${overviewDate}`));
          return { classId: cls, data: snap.exists() ? snap.data() : null };
        })
      );
      setOverviewData(results);
    } catch { toast.error("Failed to load overview"); }
    setLoadingOverview(false);
  }, [overviewDate]);

  useEffect(() => { if (tab === "overview") loadOverview(); }, [tab, loadOverview]);

  const downloadOverviewCSV = () => {
    const submitted = overviewData.filter(r => r.data);
    if (!submitted.length) { toast.error("No data to download"); return; }
    const lines = [
      ["Class", "Total Students", "Present", "Absent", "Attendance %", "Taken By"],
      ...submitted.map(({ classId: cls, data: d }) => [
        cls,
        d.totalStudents,
        d.totalPresent,
        d.totalAbsent,
        d.totalStudents > 0 ? `${Math.round((d.totalPresent / d.totalStudents) * 100)}%` : "—",
        d.takenByName || "—",
      ]),
    ];
    const totals = submitted.reduce(
      (acc, { data: d }) => ({
        s: acc.s + d.totalStudents,
        p: acc.p + d.totalPresent,
        a: acc.a + d.totalAbsent,
      }),
      { s: 0, p: 0, a: 0 }
    );
    lines.push([]);
    lines.push(["SCHOOL TOTAL", totals.s, totals.p, totals.a,
      totals.s > 0 ? `${Math.round((totals.p / totals.s) * 100)}%` : "—", ""]);
    const csv  = lines.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `SchoolAttendance_${overviewDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Reports (single class) ──────────────────────────────── */
  const [reportDate,    setReportDate]    = useState(todayStr());
  const [reportClass,   setReportClass]   = useState(role === "admin" ? CLASSES[0] : (classId || CLASSES[0]));
  const [reportData,    setReportData]    = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadReport = useCallback(async () => {
    const cls = role === "teacher" ? classId : reportClass;
    if (!cls || !reportDate) return;
    setLoadingReport(true);
    try {
      const snap = await getDoc(doc(db, "attendance", `${cls}_${reportDate}`));
      setReportData(snap.exists() ? snap.data() : null);
      if (!snap.exists()) toast("No attendance record for this date 📭", { icon: "📭" });
    } catch { toast.error("Failed to load report"); }
    setLoadingReport(false);
  }, [reportDate, reportClass, classId, role]);

  useEffect(() => { if (tab === "report") loadReport(); }, [tab, loadReport]);

  const downloadCSV = () => {
    if (!reportData) return;
    const header = ["Name","Status","Gender"];
    const rows   = reportData.records.map(r => [r.name, r.status, r.gender || "—"]);
    const footer = [
      [], [`Total: ${reportData.totalStudents}`],
      [`Present: ${reportData.totalPresent}`],
      [`Absent: ${reportData.totalAbsent}`],
      [`Taken by: ${reportData.takenByName || "—"}`],
    ];
    const csv  = [...[header], ...rows, ...footer].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `Attendance_Class${reportData.classId}_${reportData.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Derived ─────────────────────────────────────────────── */
  const presentCount = Object.values(attendance).filter(v => v === "present").length;
  const absentCount  = students.length - presentCount;

  const submittedClasses   = overviewData.filter(r => r.data);
  const schoolTotal        = submittedClasses.reduce((a, r) => a + r.data.totalStudents, 0);
  const schoolPresent      = submittedClasses.reduce((a, r) => a + r.data.totalPresent,  0);
  const schoolAbsent       = submittedClasses.reduce((a, r) => a + r.data.totalAbsent,   0);
  const schoolPct          = schoolTotal > 0 ? Math.round((schoolPresent / schoolTotal) * 100) : 0;

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 4px 40px" }}>

      {/* ── Page Header ──────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Fredoka One', cursive", fontSize: 30,
          color: "#1e1b4b", margin: 0, fontWeight: 400,
        }}>📋 Attendance</h1>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "4px 0 0" }}>
          {role === "teacher"
            ? `Class ${classId} · Take daily attendance & view reports`
            : "School-wide attendance overview & detailed class reports"}
        </p>
      </div>

      {/* ── Tab Switcher ─────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 28,
        background: "#f0f4ff", borderRadius: 16, padding: 4,
        width: "fit-content",
      }}>
        {/* Overview — admin only */}
        {role === "admin" && (
          <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
            🏫 Overview
          </TabBtn>
        )}

        {/* Take Attendance — teacher only */}
        {role === "teacher" && (
          <TabBtn active={tab === "take"} onClick={() => setTab("take")}>
            📝 Take Attendance
          </TabBtn>
        )}

        {/* Reports — both */}
        <TabBtn active={tab === "report"} onClick={() => setTab("report")}>
          📊 Class Report
        </TabBtn>
      </div>

      {/* ════════════════════════════════════════════════════
          OVERVIEW TAB  (admin only)
      ════════════════════════════════════════════════════ */}
      {tab === "overview" && role === "admin" && (
        <div>
          {/* Date picker row */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap",
            marginBottom: 24,
            background: "white", borderRadius: 20, border: "2px solid #e0e7ff",
            padding: "16px 20px",
            boxShadow: "0 2px 10px rgba(99,102,241,0.06)",
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 }}>
                📅 Select Date
              </label>
              <input
                type="date"
                value={overviewDate}
                max={todayStr()}
                onChange={e => setOverviewDate(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 12,
                  border: "2px solid #e0e7ff", fontSize: 14,
                  fontFamily: "'Poppins', sans-serif", outline: "none", color: "#1e1b4b",
                }}
              />
            </div>
            <button
              onClick={loadOverview}
              disabled={loadingOverview}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "white", border: "none", borderRadius: 12,
                padding: "10px 20px", fontWeight: 700, fontSize: 14,
                cursor: loadingOverview ? "not-allowed" : "pointer",
                opacity: loadingOverview ? 0.7 : 1,
              }}
            >
              <RefreshCw size={15} />
              {loadingOverview ? "Loading…" : "Refresh"}
            </button>
            {submittedClasses.length > 0 && (
              <button
                onClick={downloadOverviewCSV}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  color: "white", border: "none", borderRadius: 12,
                  padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                }}
              >
                <Download size={15} />
                Download All
              </button>
            )}
          </div>

          {loadingOverview ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16 }}>Loading school attendance…</div>
            </div>
          ) : (
            <>
              {/* ── School-wide grand total ─────────────── */}
              <div style={{
                background: "linear-gradient(135deg,#312e81 0%,#4f46e5 50%,#7c3aed 100%)",
                borderRadius: 22, padding: "22px 24px", marginBottom: 24,
                color: "white",
                boxShadow: "0 8px 30px rgba(79,70,229,0.3)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
                }}>
                  <School size={22} />
                  <div>
                    <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 18 }}>
                      School Overview
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {fmtDate(overviewDate)} · {submittedClasses.length}/{CLASSES.length} classes submitted
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { label: "Total Students", value: schoolTotal,   emoji: "👥", clr: "#a5b4fc" },
                    { label: "Present",         value: schoolPresent, emoji: "✅", clr: "#6ee7b7" },
                    { label: "Absent",          value: schoolAbsent,  emoji: "❌", clr: "#fca5a5" },
                    { label: "Attendance",       value: `${schoolPct}%`, emoji: "📈", clr: "#fde68a" },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, minWidth: 90,
                      background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)",
                      borderRadius: 16, padding: "14px 12px", textAlign: "center",
                      border: "1.5px solid rgba(255,255,255,0.2)",
                    }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
                      <div style={{
                        fontFamily: "'Fredoka One', cursive", fontSize: 24,
                        color: s.clr,
                      }}>{s.value}</div>
                      <div style={{ fontSize: 11, opacity: 0.75 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* School progress bar */}
                {schoolTotal > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                      <span>School Attendance Rate</span>
                      <span>{schoolPct}%</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 99, height: 8 }}>
                      <div style={{
                        width: `${schoolPct}%`, height: "100%", borderRadius: 99,
                        background: schoolPct >= 75 ? "#6ee7b7" : schoolPct >= 50 ? "#fde68a" : "#fca5a5",
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Per-class grid ──────────────────────── */}
              <div style={{ marginBottom: 12, fontFamily: "'Fredoka One', cursive", fontSize: 16, color: "#374151" }}>
                🏫 Class-wise Breakdown
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 14,
              }}>
                {overviewData.map(({ classId: cls, data }) => {
                  if (!data) {
                    return (
                      <div key={cls} style={{
                        borderRadius: 18, padding: "16px 18px",
                        background: "#f9fafb", border: "2px dashed #e5e7eb",
                        opacity: 0.7,
                      }}>
                        <div style={{
                          fontFamily: "'Fredoka One', cursive", fontSize: 15,
                          color: "#9ca3af", marginBottom: 6,
                        }}>Class {cls}</div>
                        <div style={{ fontSize: 12, color: "#d1d5db" }}>⏳ Not submitted</div>
                      </div>
                    );
                  }
                  const pct = data.totalStudents > 0
                    ? Math.round((data.totalPresent / data.totalStudents) * 100)
                    : 0;
                  const barColor = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";

                  return (
                    <div key={cls} style={{
                      borderRadius: 18, padding: "16px 18px",
                      background: "white", border: "2px solid #e0e7ff",
                      boxShadow: "0 3px 12px rgba(99,102,241,0.07)",
                      transition: "transform 0.15s, box-shadow 0.15s",
                      cursor: "default",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(99,102,241,0.15)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 3px 12px rgba(99,102,241,0.07)";
                    }}
                    >
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{
                          fontFamily: "'Fredoka One', cursive", fontSize: 16, color: "#1e1b4b",
                        }}>Class {cls}</div>
                        <PctRing pct={pct} size={48} />
                      </div>

                      {/* Counts */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        <div style={{
                          flex: 1, textAlign: "center", borderRadius: 10, padding: "8px 4px",
                          background: "#d1fae5", border: "1.5px solid #6ee7b7",
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#065f46", fontFamily: "'Fredoka One', cursive" }}>
                            {data.totalPresent}
                          </div>
                          <div style={{ fontSize: 10, color: "#047857", fontWeight: 700 }}>Present</div>
                        </div>
                        <div style={{
                          flex: 1, textAlign: "center", borderRadius: 10, padding: "8px 4px",
                          background: "#fee2e2", border: "1.5px solid #fca5a5",
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#991b1b", fontFamily: "'Fredoka One', cursive" }}>
                            {data.totalAbsent}
                          </div>
                          <div style={{ fontSize: 10, color: "#b91c1c", fontWeight: 700 }}>Absent</div>
                        </div>
                        <div style={{
                          flex: 1, textAlign: "center", borderRadius: 10, padding: "8px 4px",
                          background: "#f3f4f6", border: "1.5px solid #e5e7eb",
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#374151", fontFamily: "'Fredoka One', cursive" }}>
                            {data.totalStudents}
                          </div>
                          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>Total</div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ background: "#f3f4f6", borderRadius: 99, height: 6, overflow: "hidden" }}>
                        <div style={{
                          width: `${pct}%`, height: "100%", borderRadius: 99,
                          background: barColor, transition: "width 0.6s ease",
                        }} />
                      </div>

                      {/* Taken by */}
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 7 }}>
                        By {data.takenByName || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Not-submitted summary */}
              {overviewData.filter(r => !r.data).length > 0 && (
                <div style={{
                  marginTop: 20, padding: "12px 18px",
                  background: "#fffbeb", border: "2px solid #fde68a",
                  borderRadius: 14,
                }}>
                  <span style={{ fontSize: 13, color: "#92400e", fontWeight: 700 }}>
                    ⚠️ Attendance not yet submitted for:{" "}
                  </span>
                  <span style={{ fontSize: 13, color: "#b45309" }}>
                    {overviewData.filter(r => !r.data).map(r => `Class ${r.classId}`).join(" · ")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TAKE ATTENDANCE TAB  (teacher only)
      ════════════════════════════════════════════════════ */}
      {tab === "take" && role === "teacher" && (
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 10, marginBottom: 18,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "white", borderRadius: 14, border: "2px solid #e0e7ff",
              padding: "10px 16px", boxShadow: "0 2px 8px rgba(99,102,241,0.08)",
            }}>
              <CalendarDays size={18} color="#6366f1" />
              <span style={{ fontFamily: "'Fredoka One', cursive", color: "#312e81", fontSize: 15 }}>
                {fmtDate(todayStr())}
              </span>
              <span style={{
                background: "#e0e7ff", color: "#4f46e5",
                borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700,
              }}>Class {classId}</span>
            </div>
            {!loadingStudents && students.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700 }}>
                  ✅ {presentCount} Present
                </span>
                <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700 }}>
                  ❌ {absentCount} Absent
                </span>
              </div>
            )}
          </div>

          {todayRecord && !editMode && (
            <div style={{
              background: "linear-gradient(135deg,#d1fae5,#a7f3d0)", border: "2px solid #6ee7b7",
              borderRadius: 18, padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 10, marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={22} color="#065f46" />
                <div>
                  <div style={{ fontFamily: "'Fredoka One', cursive", color: "#065f46", fontSize: 15 }}>
                    Attendance already submitted today!
                  </div>
                  <div style={{ fontSize: 12, color: "#047857" }}>
                    {todayRecord.totalPresent} present · {todayRecord.totalAbsent} absent · By {todayRecord.takenByName}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                style={{
                  background: "#065f46", color: "white", border: "none", borderRadius: 12,
                  padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >✏️ Edit</button>
            </div>
          )}

          {loadingStudents ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16 }}>Loading students…</div>
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, background: "white", borderRadius: 20, border: "2px dashed #e0e7ff", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎒</div>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 16 }}>No students found in Class {classId}</div>
            </div>
          ) : (
            <>
              {(!todayRecord || editMode) && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button onClick={() => markAll("present")} style={{
                    background: "#d1fae5", color: "#065f46", border: "2px solid #6ee7b7",
                    borderRadius: 12, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>✅ All Present</button>
                  <button onClick={() => markAll("absent")} style={{
                    background: "#fee2e2", color: "#991b1b", border: "2px solid #fca5a5",
                    borderRadius: 12, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>❌ All Absent</button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {students.map((s, i) => {
                  const isPresent = (attendance[s.uid] || "present") === "present";
                  const canToggle = !todayRecord || editMode;
                  return (
                    <div
                      key={s.uid}
                      onClick={() => canToggle && toggleStudent(s.uid)}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "13px 16px", borderRadius: 16,
                        background: isPresent ? "#f0fdf4" : "#fff5f5",
                        border: `2px solid ${isPresent ? "#86efac" : "#fca5a5"}`,
                        cursor: canToggle ? "pointer" : "default",
                        transition: "all 0.15s",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <span style={{ width: 26, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>{i + 1}</span>
                      <AvatarCircle name={s.name} gender={s.gender} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.gender || "—"}</div>
                      </div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: isPresent ? "#dcfce7" : "#fee2e2",
                        borderRadius: 20, padding: "6px 14px",
                        fontWeight: 700, fontSize: 13,
                        color: isPresent ? "#166534" : "#991b1b",
                        minWidth: 100, justifyContent: "center",
                      }}>
                        {isPresent ? <><CheckCircle size={15} /> Present</> : <><XCircle size={15} /> Absent</>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {(!todayRecord || editMode) && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: "100%", padding: "15px",
                    background: submitting
                      ? "#a5b4fc"
                      : "linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%)",
                    color: "white", border: "none", borderRadius: 50,
                    fontFamily: "'Fredoka One', cursive", fontSize: 18, fontWeight: 400,
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: submitting ? "none" : "0 6px 0 rgba(99,102,241,0.35)",
                    transition: "all 0.15s",
                  }}
                >
                  {submitting ? "⏳ Saving…" : `✅ Submit Attendance (${presentCount}/${students.length} present)`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          CLASS REPORT TAB
      ════════════════════════════════════════════════════ */}
      {tab === "report" && (
        <div>
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 24,
            background: "white", borderRadius: 20, border: "2px solid #e0e7ff",
            padding: "16px 20px", boxShadow: "0 2px 10px rgba(99,102,241,0.06)",
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 }}>📅 Date</label>
              <input
                type="date" value={reportDate} max={todayStr()}
                onChange={e => setReportDate(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 12,
                  border: "2px solid #e0e7ff", fontSize: 14,
                  fontFamily: "'Poppins', sans-serif", outline: "none", color: "#1e1b4b",
                }}
              />
            </div>
            {role === "admin" && (
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 }}>🏫 Class</label>
                <select
                  value={reportClass}
                  onChange={e => setReportClass(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 12,
                    border: "2px solid #e0e7ff", fontSize: 14,
                    fontFamily: "'Poppins', sans-serif", outline: "none", color: "#1e1b4b", background: "white",
                  }}
                >
                  {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={loadReport}
              disabled={loadingReport}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "white", border: "none", borderRadius: 12,
                padding: "10px 20px", fontWeight: 700, fontSize: 14,
                cursor: loadingReport ? "not-allowed" : "pointer", opacity: loadingReport ? 0.7 : 1,
              }}
            >
              <RefreshCw size={15} />
              {loadingReport ? "Loading…" : "Load"}
            </button>
          </div>

          {!reportData && !loadingReport && (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "white", borderRadius: 20, border: "2px dashed #e0e7ff", color: "#9ca3af",
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 18, color: "#374151" }}>No attendance record found</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                No data for {fmtDateShort(reportDate)} — Class {role === "teacher" ? classId : reportClass}
              </div>
            </div>
          )}

          {reportData && (
            <>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 10, marginBottom: 18,
              }}>
                <div>
                  <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 18, color: "#1e1b4b" }}>
                    Class {reportData.classId} · {fmtDate(reportData.date)}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    Taken by {reportData.takenByName || "—"}
                  </div>
                </div>
                <button
                  onClick={downloadCSV}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "linear-gradient(135deg,#10b981,#059669)",
                    color: "white", border: "none", borderRadius: 14,
                    padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                  }}
                >
                  <Download size={16} /> Download CSV
                </button>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                <StatCard emoji="👥" label="Total Students" value={reportData.totalStudents} color="#6366f1" bg="#eef2ff" />
                <StatCard emoji="✅" label="Present"        value={reportData.totalPresent}  color="#059669" bg="#d1fae5" />
                <StatCard emoji="❌" label="Absent"         value={reportData.totalAbsent}   color="#dc2626" bg="#fee2e2" />
                <StatCard
                  emoji="📈" label="Attendance %"
                  value={reportData.totalStudents > 0
                    ? `${Math.round((reportData.totalPresent / reportData.totalStudents) * 100)}%`
                    : "—"}
                  color={reportData.totalStudents > 0 && (reportData.totalPresent / reportData.totalStudents) >= 0.75 ? "#d97706" : "#dc2626"}
                  bg="#fffbeb"
                />
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {/* Present */}
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Fredoka One', cursive", fontSize: 16, color: "#065f46", marginBottom: 10 }}>
                    <CheckCircle size={18} /> Present ({reportData.totalPresent})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {reportData.records.filter(r => r.status === "present").map((r, i) => (
                      <div key={r.uid} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f0fdf4", border: "2px solid #86efac", borderRadius: 14, padding: "10px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 20 }}>{i+1}</span>
                        <AvatarCircle name={r.name} gender={r.gender} size={32} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{r.gender || "—"}</div>
                        </div>
                      </div>
                    ))}
                    {reportData.totalPresent === 0 && <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 16 }}>No students present</div>}
                  </div>
                </div>

                {/* Absent */}
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Fredoka One', cursive", fontSize: 16, color: "#991b1b", marginBottom: 10 }}>
                    <XCircle size={18} /> Absent ({reportData.totalAbsent})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {reportData.records.filter(r => r.status === "absent").map((r, i) => (
                      <div key={r.uid} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff5f5", border: "2px solid #fca5a5", borderRadius: 14, padding: "10px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 20 }}>{i+1}</span>
                        <AvatarCircle name={r.name} gender={r.gender} size={32} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{r.gender || "—"}</div>
                        </div>
                      </div>
                    ))}
                    {reportData.totalAbsent === 0 && <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 16 }}>No students absent 🎉</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tab button helper ───────────────────────────────── */
function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 22px", borderRadius: 13, border: "none",
        cursor: "pointer", fontSize: 14, fontWeight: 700,
        fontFamily: "'Poppins', sans-serif",
        background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
        color:      active ? "white" : "#6b7280",
        boxShadow:  active ? "0 4px 12px rgba(99,102,241,0.3)" : "none",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
