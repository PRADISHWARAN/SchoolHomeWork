import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Save } from "lucide-react";
import toast from "react-hot-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_TIMES = {
  1: "8:00-8:45",
  2: "8:45-9:30",
  3: "9:30-10:15",
  4: "10:30-11:15",
  5: "11:15-12:00",
  6: "1:00-1:45",
  7: "1:45-2:30",
  8: "2:30-3:15",
};

export default function Timetable() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  const classId = userProfile?.classId;

  const [periodTimes, setPeriodTimes] = useState({ ...DEFAULT_TIMES });
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (classId) fetchTimetable();
  }, [classId]);

  async function fetchTimetable() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "timetables", classId));
      if (snap.exists()) {
        const data = snap.data();
        setPeriodTimes(data.schedule?.periodTimes || { ...DEFAULT_TIMES });
        setDays(data.schedule?.days || {});
        setUpdatedBy(data.updatedBy || null);
        setUpdatedAt(data.updatedAt?.toDate?.() || null);
      }
    } catch {
      toast.error("Failed to load timetable");
    }
    setLoading(false);
  }

  function handleSubjectChange(day, period, value) {
    setDays(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [period]: value },
    }));
  }

  function handleTimeChange(period, value) {
    setPeriodTimes(prev => ({ ...prev, [period]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, "timetables", classId), {
        classId,
        schedule: { periodTimes, days },
        updatedAt: serverTimestamp(),
        updatedBy: userProfile.name,
      });
      toast.success("Timetable saved!");
      setEditMode(false);
      fetchTimetable();
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  if (loading) return <div className="loader"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📅 Class Timetable</h1>
          <p>
            Class {classId} weekly schedule
            {updatedBy && updatedAt && ` · Last updated by ${updatedBy} on ${updatedAt.toLocaleDateString()}`}
          </p>
        </div>
        {role === "teacher" && (
          <div style={{ display: "flex", gap: 10 }}>
            {editMode ? (
              <>
                <button
                  style={styles.cancelBtn}
                  onClick={() => { setEditMode(false); fetchTimetable(); }}
                >
                  Cancel
                </button>
                <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  <Save size={16} style={{ marginRight: 6 }} />
                  {saving ? "Saving..." : "Save Timetable"}
                </button>
              </>
            ) : (
              <button style={styles.editBtn} onClick={() => setEditMode(true)}>
                ✏️ Edit Timetable
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 60 }}>Period</th>
              <th style={{ ...styles.th, width: 110 }}>Time</th>
              {DAYS.map(day => (
                <th key={day} style={styles.th}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, idx) => (
              <tr key={period} style={idx % 2 === 0 ? {} : { background: "#fafafa" }}>
                <td style={styles.periodCell}>P{period}</td>
                <td style={styles.timeCell}>
                  {editMode && role === "teacher" ? (
                    <input
                      value={periodTimes[period] || ""}
                      onChange={e => handleTimeChange(period, e.target.value)}
                      style={styles.timeInput}
                      placeholder="9:00-9:45"
                    />
                  ) : (
                    <span style={styles.timeLabel}>{periodTimes[period] || "—"}</span>
                  )}
                </td>
                {DAYS.map(day => {
                  const subject = days[day]?.[period] || "";
                  return (
                    <td key={day} style={styles.cell}>
                      {editMode && role === "teacher" ? (
                        <input
                          value={subject}
                          onChange={e => handleSubjectChange(day, period, e.target.value)}
                          placeholder="Subject"
                          style={styles.cellInput}
                        />
                      ) : (
                        <span style={subject ? styles.subjectLabel : styles.emptyCell}>
                          {subject || "—"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {role === "teacher" && !editMode && (
        <p style={{ marginTop: 14, fontSize: 13, color: "#9ca3af", fontFamily: "'Poppins', sans-serif" }}>
          Click <strong>Edit Timetable</strong> to update subjects and period times for your class.
        </p>
      )}
    </div>
  );
}

const styles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "white",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 2px 20px rgba(79,70,229,0.08)",
    minWidth: 700,
  },
  th: {
    padding: "14px 12px",
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "white",
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 800,
    fontSize: 13,
    textAlign: "center",
    borderRight: "1px solid rgba(255,255,255,0.15)",
  },
  periodCell: {
    padding: "10px 12px",
    background: "#f0f0ff",
    color: "#4f46e5",
    fontWeight: 800,
    fontSize: 13,
    textAlign: "center",
    fontFamily: "'Nunito', sans-serif",
    borderRight: "1px solid #e0e7ff",
    borderBottom: "1px solid #f0f0ff",
  },
  timeCell: {
    padding: "8px 10px",
    textAlign: "center",
    borderRight: "1px solid #f0f0ff",
    borderBottom: "1px solid #f0f0ff",
  },
  timeLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "'Poppins', sans-serif",
  },
  cell: {
    padding: "8px 10px",
    textAlign: "center",
    borderRight: "1px solid #f0f0ff",
    borderBottom: "1px solid #f0f0ff",
  },
  subjectLabel: {
    display: "inline-block",
    padding: "4px 10px",
    background: "#ede9fe",
    color: "#4f46e5",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Poppins', sans-serif",
  },
  emptyCell: { color: "#d1d5db", fontSize: 12 },
  cellInput: {
    width: "100%",
    padding: "6px 8px",
    border: "1.5px solid #e0e7ff",
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "'Poppins', sans-serif",
    outline: "none",
    textAlign: "center",
    minWidth: 80,
    boxSizing: "border-box",
  },
  timeInput: {
    width: "100%",
    padding: "5px 6px",
    border: "1.5px solid #e0e7ff",
    borderRadius: 8,
    fontSize: 11,
    fontFamily: "'Poppins', sans-serif",
    outline: "none",
    textAlign: "center",
    boxSizing: "border-box",
  },
  editBtn: {
    padding: "10px 20px",
    background: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    cursor: "pointer",
  },
  saveBtn: {
    display: "flex",
    alignItems: "center",
    padding: "10px 20px",
    background: "#10b981",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 20px",
    background: "white",
    color: "#6b7280",
    border: "1.5px solid #e5e7eb",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    cursor: "pointer",
  },
};
