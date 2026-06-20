import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme, THEMES } from "../context/ThemeContext";
import { LogOut, Menu, X } from "lucide-react";


const adminLinks = [
  { emoji: "🏠", label: "Dashboard",         path: "/dashboard",    color: "#6366f1" },
  { emoji: "👥", label: "Manage Users",      path: "/manage-users", color: "#ec4899" },
  { emoji: "📖", label: "All Homework",      path: "/all-homework", color: "#0891b2" },
  { emoji: "🗓️", label: "Attendance",        path: "/attendance",   color: "#10b981" },
  { emoji: "📆", label: "Academic Calendar", path: "/calendar",     color: "#f59e0b" },
  { emoji: "🎙️", label: "Voice Doubts",      path: "/doubts",       color: "#7c3aed" },
  { emoji: "🚌", label: "Bus Tracker",       path: "/bus-tracker",  color: "#1d4ed8" },
];
const teacherLinks = [
  { emoji: "🏠", label: "Dashboard",         path: "/dashboard",    color: "#6366f1" },
  { emoji: "✏️", label: "Post Homework",      path: "/post-homework",color: "#10b981" },
  { emoji: "📋", label: "Submissions",        path: "/submissions",  color: "#8b5cf6" },
  { emoji: "🗓️", label: "Attendance",        path: "/attendance",   color: "#059669" },
  { emoji: "📅", label: "Timetable",          path: "/timetable",    color: "#f59e0b" },
  { emoji: "📆", label: "Academic Calendar",  path: "/calendar",     color: "#ec4899" },
  { emoji: "🎙️", label: "Voice Doubts",       path: "/doubts",       color: "#7c3aed" },
  { emoji: "🚌", label: "Bus Tracker",        path: "/bus-tracker",  color: "#1d4ed8" },
];
const studentLinks = [
  { emoji: "🏠", label: "Dashboard",         path: "/dashboard",    color: "#6366f1" },
  { emoji: "📚", label: "My Homework",       path: "/my-homework",  color: "#f59e0b" },
  { emoji: "📅", label: "Timetable",          path: "/timetable",    color: "#10b981" },
  { emoji: "📆", label: "Academic Calendar",  path: "/calendar",     color: "#ec4899" },
  { emoji: "🎙️", label: "Voice Doubts",       path: "/doubts",       color: "#7c3aed" },
  { emoji: "🚌", label: "Bus Tracker",        path: "/bus-tracker",  color: "#1d4ed8" },
];
const driverLinks = [
  { emoji: "🚌", label: "Bus Tracker",        path: "/bus-tracker",  color: "#1d4ed8" },
];

export default function Sidebar() {
  const { userProfile, profileLoading, logout } = useAuth();
  const { themeId, setThemeId, themeConfig } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = userProfile?.role;

  const links =
    role === "admin"   ? adminLinks :
    role === "teacher" ? teacherLinks :
    role === "student" ? studentLinks :
    role === "driver"  ? driverLinks :
    [{ emoji: "🏠", label: "Dashboard", path: "/dashboard", color: "#6366f1" }];

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const sidebarContent = (
    <div style={{ ...styles.sidebar, backgroundImage: themeConfig?.sidebar || styles.sidebar.backgroundImage }}>

      {/* School Logo */}
      <div style={{ textAlign: "center", padding: "14px 0 12px" }}>
        <img
          src="/logo.png"
          alt="Vaanavil Vidyalaya"
          style={{
            width: 88, height: 88,
            borderRadius: "50%",
            objectFit: "cover",
            border: "3px solid rgba(255,255,255,0.45)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            display: "block",
            margin: "0 auto 8px",
          }}
        />
        <div style={{
          fontFamily: "'Fredoka One', cursive",
          fontSize: 15, letterSpacing: 0.3,
          color: "rgba(255,255,255,0.95)",
          lineHeight: 1.2,
        }}>
          Vaanavil Vidyalaya
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: "rgba(255,255,255,0.55)",
          marginTop: 3,
        }}>
          Homework Portal ✨
        </div>
      </div>

      {/* User Info */}
      <div style={styles.userBox}>
        {userProfile?.photoURL ? (
          <img src={userProfile.photoURL} alt={userProfile.name}
            style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover",
              flexShrink: 0, border: "2.5px solid rgba(255,255,255,0.5)" }} />
        ) : (
          <div style={styles.avatar}>
            {userProfile?.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.userName}>
            {userProfile?.name || (profileLoading ? "Loading..." : "User")}
          </div>
          <div style={styles.userClass}>
            {role === "student"  ? `Class ${userProfile?.classId}` :
             role === "teacher"  ? `Teacher · ${userProfile?.classId}` :
             role === "admin"    ? "Administrator" :
             role === "driver"   ? "Bus Driver" :
             profileLoading      ? "..." : "Unknown role"}
          </div>
          {userProfile?.gender && (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 1 }}>
              {userProfile.gender === "Male" ? "♂" : userProfile.gender === "Female" ? "♀" : "⚥"} {userProfile.gender}
            </div>
          )}
        </div>
      </div>

      {/* Nav Links */}
      <nav style={styles.nav}>
        {links.map((link) => {
          const active = location.pathname === link.path;
          return (
            <button
              key={link.path}
              onClick={() => { navigate(link.path); setMobileOpen(false); }}
              style={{
                ...styles.navBtn,
                ...(active ? { background: "rgba(255,255,255,0.22)" } : {}),
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
                background: active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                transition: "background 0.2s",
              }}>{link.emoji}</span>
              <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: 15, fontWeight: 400 }}>
                {link.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <button onClick={handleLogout} style={styles.logoutBtn}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.3)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
      >
        <LogOut size={17} />
        <span style={{ fontFamily: "'Fredoka One', cursive", fontWeight: 400, fontSize: 15 }}>Logout</span>
      </button>

      {/* Theme Switcher */}
      <div style={{ borderTop: "1.5px solid rgba(255,255,255,0.15)", paddingTop: 10, marginTop: 4 }}>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, textAlign: "center", marginBottom: 6, fontFamily: "'Fredoka One', cursive", letterSpacing: "1px" }}>
          THEME
        </div>
        <div className="theme-picker">
          {Object.values(THEMES).map(t => (
            <div
              key={t.id}
              title={t.label}
              className={`theme-dot ${themeId === t.id ? "active" : ""}`}
              style={{ background: t.dot }}
              onClick={() => setThemeId(t.id)}
            />
          ))}
        </div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, textAlign: "center", marginTop: 4, fontFamily: "'Fredoka One', cursive" }}>
          {THEMES[themeId]?.label}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div data-desktop-sidebar style={styles.desktopWrapper}>{sidebarContent}</div>

      <button data-hamburger style={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {mobileOpen && (
        <div style={{ ...styles.mobileOverlay, display: "block" }} onClick={() => setMobileOpen(false)}>
          <div style={styles.mobileSidebar} onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  desktopWrapper: { position: "fixed", top: 0, left: 0, height: "100vh", width: 268, zIndex: 100, display: "none" },
  sidebar: {
    width: 268,
    height: "100vh",
    backgroundImage: "linear-gradient(160deg, #312e81 0%, #4f46e5 50%, #7c3aed 100%)",
    display: "flex",
    flexDirection: "column",
    padding: "12px 14px 22px",
    overflowY: "auto",
    gap: 0,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
    paddingBottom: 14, borderBottom: "1.5px solid rgba(255,255,255,0.15)",
  },
  logoIcon: {
    width: 40, height: 40,
    background: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, flexShrink: 0,
  },
  logoText: {
    color: "white", fontFamily: "'Fredoka One', cursive",
    fontWeight: 400, fontSize: 15, letterSpacing: "0.2px",
  },
  logoSub:  { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 600 },
  userBox: {
    display: "flex", alignItems: "flex-start", gap: 11,
    background: "rgba(255,255,255,0.13)",
    borderRadius: 16, padding: "12px 13px", marginBottom: 14,
  },
  avatar: {
    width: 42, height: 42, borderRadius: "50%",
    background: "linear-gradient(135deg, #fde68a, #f59e0b)",
    color: "#92400e",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 900, fontSize: 18, flexShrink: 0,
    fontFamily: "'Fredoka One', cursive",
  },
  userName:  { color: "white", fontWeight: 800, fontSize: 14, fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userClass: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
  nav: { display: "flex", flexDirection: "column", gap: 3, flex: 1 },
  navBtn: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 10px", borderRadius: 14, border: "none",
    background: "transparent", color: "white",
    fontSize: 14, cursor: "pointer",
    textAlign: "left", transition: "background 0.2s",
    fontFamily: "'Fredoka One', cursive",
  },
  logoutBtn: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "11px 13px", borderRadius: 14, border: "none",
    background: "rgba(239,68,68,0.15)", color: "#fca5a5",
    fontSize: 14, cursor: "pointer",
    marginTop: 8, transition: "background 0.2s",
  },
  hamburger: {
    display: "none", position: "fixed", top: 16, left: 16, zIndex: 1200,
    background: "#4f46e5", border: "none", borderRadius: 12,
    padding: 10, cursor: "pointer", color: "white",
    boxShadow: "0 4px 12px rgba(79,70,229,0.4)",
  },
  mobileOverlay: { display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100 },
  mobileSidebar: { width: 268, height: "100%" },
};

const styleEl = document.createElement("style");
styleEl.textContent = `
  @media (min-width: 769px) {
    [data-desktop-sidebar] { display: block !important; }
    [data-hamburger] { display: none !important; }
  }
  @media (max-width: 768px) {
    [data-desktop-sidebar] { display: none !important; }
    [data-hamburger] { display: flex !important; }
  }
`;
if (!document.head.querySelector("[data-sidebar-styles]")) {
  styleEl.setAttribute("data-sidebar-styles", "");
  document.head.appendChild(styleEl);
}
