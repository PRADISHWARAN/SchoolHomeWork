import React from "react";

/** Class dropdown for "All classes" teachers (see hooks/useTeacherClass). */
export default function ClassPicker({ classes, value, onChange, label = "Class" }) {
  if (!classes?.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <label htmlFor="class-picker" style={{ fontWeight: 700, fontSize: 14, color: "#4b5563" }}>
        🏫 {label}:
      </label>
      <select
        id="class-picker"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: "9px 14px", borderRadius: 12, border: "2px solid #e0e7ff",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#312e81",
          background: "white", outline: "none", minWidth: 120,
        }}
      >
        {classes.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
