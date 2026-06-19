import React, { useState } from "react";

const DAY_LABELS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * HomeworkCalendar
 *
 * Props:
 *  - homeworkList     : array of homework docs (must have createdAt.seconds)
 *  - submissionsMap   : { [homeworkId]: submittedCount }
 *  - totalStudents    : number  (0 = don't show %)
 *  - showClass        : bool    (show class badge on each card — useful for admin "All" view)
 */
export default function HomeworkCalendar({
  homeworkList   = [],
  submissionsMap = {},
  totalStudents  = 0,
  showClass      = false,
}) {
  /* ── Default to the month of the most-recent homework, else today ── */
  const [currentMonth, setCurrentMonth] = useState(() => {
    let latest = null;
    homeworkList.forEach((hw) => {
      if (hw.createdAt?.seconds) {
        const d = new Date(hw.createdAt.seconds * 1000);
        if (!latest || d > latest) latest = d;
      }
    });
    if (latest) return new Date(latest.getFullYear(), latest.getMonth(), 1);
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const [selectedKey, setSelectedKey] = useState(null);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDow      = new Date(year, month, 1).getDay();   // 0=Sun
  const daysInMonth   = new Date(year, month + 1, 0).getDate();

  const today    = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  /* ── Build date → homework list map (by createdAt) ── */
  const hwByDate = {};
  homeworkList.forEach((hw) => {
    if (hw.createdAt?.seconds) {
      const d   = new Date(hw.createdAt.seconds * 1000);
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (!hwByDate[key]) hwByDate[key] = [];
      hwByDate[key].push(hw);
    }
  });

  /* ── Calendar cells: padding nulls + day numbers ── */
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedHw = selectedKey ? (hwByDate[selectedKey] || []) : [];

  function prevMonth() { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedKey(null); }
  function nextMonth() { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedKey(null); }

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* ── Month navigator ── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 16,
      }}>
        <button onClick={prevMonth} style={navBtn}>◀ Prev</button>

        <div style={{
          fontFamily: "'Fredoka One', cursive", fontSize: 22, color: "#1e1b4b",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          📅 {MONTH_NAMES[month]} {year}
        </div>

        <button onClick={nextMonth} style={navBtn}>Next ▶</button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {DAY_LABELS.map((d) => (
          <div key={d} style={{
            textAlign: "center", fontSize: 11, fontWeight: 700,
            color: "#9ca3af", padding: "5px 0", textTransform: "uppercase",
          }}>{d}</div>
        ))}
      </div>

      {/* ── Day cells ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} style={{ minHeight: 56 }} />;

          const key    = dateKey(year, month, day);
          const dayHw  = hwByDate[key] || [];
          const hasHw  = dayHw.length > 0;
          const isTdy  = key === todayKey;
          const isSel  = key === selectedKey;

          /* subject-colour dots (max 3) */
          const SUBJECT_COLORS = {
            Mathematics: "#f59e0b", English: "#6366f1", Science: "#10b981",
            "Social Studies": "#0891b2", Hindi: "#7c3aed", Tamil: "#dc2626",
            Computer: "#0284c7", Drawing: "#d97706", EVS: "#059669",
            "General Knowledge": "#7c3aed",
          };

          return (
            <div
              key={key}
              onClick={() => hasHw && setSelectedKey(isSel ? null : key)}
              style={{
                minHeight: 56, borderRadius: 12, padding: "6px 4px 8px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                cursor: hasHw ? "pointer" : "default",
                background: isSel
                  ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                  : hasHw ? "#f0f4ff" : "transparent",
                border: `2px solid ${isTdy ? "#6366f1" : isSel ? "#6366f1" : "transparent"}`,
                transition: "all 0.15s",
                boxShadow: isSel ? "0 4px 14px rgba(99,102,241,0.35)" : "none",
              }}
              onMouseEnter={e => { if (hasHw && !isSel) e.currentTarget.style.background = "#e0e7ff"; }}
              onMouseLeave={e => { if (hasHw && !isSel) e.currentTarget.style.background = "#f0f4ff"; }}
            >
              {/* Day number */}
              <span style={{
                fontSize: 14, fontWeight: isTdy || isSel ? 900 : 600,
                color: isSel ? "white" : isTdy ? "#6366f1" : "#374151",
                lineHeight: 1,
              }}>{day}</span>

              {/* Homework dots */}
              {hasHw && (
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                  {dayHw.slice(0, 3).map((hw, di) => (
                    <div key={di} title={hw.title} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: isSel
                        ? "rgba(255,255,255,0.8)"
                        : (hw.type === "game" ? "#ec4899" : (SUBJECT_COLORS[hw.subject] || "#6366f1")),
                    }} />
                  ))}
                  {dayHw.length > 3 && (
                    <span style={{ fontSize: 9, color: isSel ? "rgba(255,255,255,0.8)" : "#6b7280", fontWeight: 700 }}>
                      +{dayHw.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Count badge */}
              {hasHw && (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: isSel ? "white" : "#6366f1",
                  background: isSel ? "rgba(255,255,255,0.2)" : "#e0e7ff",
                  borderRadius: 50, padding: "1px 6px", lineHeight: 1.4,
                }}>
                  {dayHw.length}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11, color: "#9ca3af", flexWrap: "wrap" }}>
        {[
          { bg: "#f0f4ff", border: "#e0e7ff", label: "Has homework" },
          { bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", label: "Selected date" },
          { bg: "transparent", border: "#6366f1", label: "Today" },
        ].map(({ bg, border, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 4,
              background: bg,
              border: border !== "none" ? `2px solid ${border}` : "none",
            }} />
            {label}
          </div>
        ))}
      </div>

      {/* ── Selected date homework panel ── */}
      {selectedKey && selectedHw.length > 0 && (
        <div style={{ marginTop: 22 }}>
          {/* Panel header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap",
          }}>
            <div style={{
              fontFamily: "'Fredoka One', cursive", fontSize: 17, color: "#1e1b4b",
            }}>
              📅 {new Date(selectedKey + "T00:00:00").toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </div>
            <span style={{
              background: "#e0e7ff", color: "#4f46e5",
              fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 50,
            }}>
              {selectedHw.length} assignment{selectedHw.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Homework cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {selectedHw.map((hw) => {
              const subCount = submissionsMap[hw.id] || 0;
              const pct      = totalStudents > 0
                ? Math.round((subCount / totalStudents) * 100)
                : null;
              const isGame  = hw.type === "game";
              const dueDateObj = hw.dueDate ? new Date(hw.dueDate + "T00:00:00") : null;
              const dueDate = dueDateObj
                ? dueDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : null;
              const dueTimeStr = hw.dueTime
                ? new Date(`2000-01-01T${hw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : null;
              const pending = pct !== null ? totalStudents - subCount : null;

              return (
                <div key={hw.id} style={{
                  background: "white", borderRadius: 16,
                  border: "1.5px solid #e0e7ff",
                  padding: "16px 18px",
                  boxShadow: "0 4px 16px rgba(99,102,241,0.07)",
                }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: isGame ? "linear-gradient(135deg,#fef3c7,#fce7f3)" : "#e0e7ff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>
                      {isGame ? "🎮" : "📝"}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title */}
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", marginBottom: 4 }}>
                        {hw.title}
                      </div>

                      {/* Meta row */}
                      <div style={{
                        display: "flex", gap: 8, flexWrap: "wrap",
                        fontSize: 12, color: "#6b7280", marginBottom: 10,
                      }}>
                        {hw.subject && (
                          <span style={{
                            background: "#e0e7ff", color: "#4f46e5",
                            borderRadius: 50, padding: "2px 8px", fontWeight: 700,
                          }}>{hw.subject}</span>
                        )}
                        {showClass && (
                          <span style={{
                            background: "#d1fae5", color: "#059669",
                            borderRadius: 50, padding: "2px 8px", fontWeight: 700,
                          }}>Class {hw.classId}</span>
                        )}
                        {dueDate && <span>📅 Due: {dueDate}{dueTimeStr ? ` · ⏰ ${dueTimeStr}` : ""}</span>}
                        {hw.teacherName && <span>👩‍🏫 {hw.teacherName}</span>}
                      </div>

                      {/* Submission stats */}
                      {pct !== null ? (
                        <div>
                          <div style={{
                            display: "flex", justifyContent: "space-between",
                            fontSize: 12, marginBottom: 5,
                          }}>
                            <div style={{ display: "flex", gap: 12 }}>
                              <span style={{ color: "#059669", fontWeight: 700 }}>
                                ✅ {subCount} submitted
                              </span>
                              {pending > 0 && (
                                <span style={{ color: "#dc2626", fontWeight: 700 }}>
                                  ❌ {pending} pending
                                </span>
                              )}
                            </div>
                            <span style={{
                              fontWeight: 800, fontSize: 13,
                              color: pct === 100 ? "#059669" : pct >= 50 ? "#6366f1" : "#dc2626",
                            }}>
                              {pct}%
                            </span>
                          </div>
                          <div style={{
                            background: "#e0e7ff", borderRadius: 50, height: 10, overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${pct}%`, height: "100%", borderRadius: 50,
                              background: pct === 100
                                ? "linear-gradient(90deg,#10b981,#34d399)"
                                : pct >= 50
                                  ? "linear-gradient(90deg,#6366f1,#8b5cf6)"
                                  : "linear-gradient(90deg,#f59e0b,#ef4444)",
                              transition: "width 0.7s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                            {totalStudents} total students
                          </div>
                        </div>
                      ) : (
                        /* No student count available — show raw count */
                        subCount > 0 && (
                          <span style={{
                            background: "#d1fae5", color: "#059669",
                            borderRadius: 50, padding: "3px 10px",
                            fontSize: 12, fontWeight: 700,
                          }}>
                            ✅ {subCount} submitted
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ── */
const navBtn = {
  background: "#f0f4ff", border: "1.5px solid #e0e7ff", borderRadius: 10,
  padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700,
  color: "#6366f1", fontFamily: "'Poppins', sans-serif", transition: "all 0.15s",
};
