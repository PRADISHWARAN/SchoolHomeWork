import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase/config";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useFCM } from "./hooks/useFCM";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PostHomework from "./pages/PostHomework";
import MyHomework from "./pages/MyHomework";
import Submissions from "./pages/Submissions";
import ManageUsers from "./pages/ManageUsers";
import AllHomework from "./pages/AllHomework";
import Timetable from "./pages/Timetable";
import AcademicCalendar from "./pages/AcademicCalendar";
import Attendance from "./pages/Attendance";
import BusTracker from "./pages/BusTracker";
import DoubtsChannel from "./pages/DoubtsChannel";
import "./styles/global.css";

/* ── Holiday detection ──────────────────────────────────── */
function getHoliday() {
  const d  = new Date();
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  if (md >= 1019 && md <= 1105) return { emoji: "🪔", msg: "Happy Diwali! May your learning shine as bright as these lights!", color: "#d97706", bg: "#fffbeb" };
  if (md >= 1215 && md <= 1226) return { emoji: "🎄", msg: "Merry Christmas! Keep learning and stay curious this holiday!", color: "#16a34a", bg: "#f0fff4" };
  if (md >= 1227 || md <= 105)  return { emoji: "🎆", msg: "Happy New Year! New year, new goals, new achievements!", color: "#7c3aed", bg: "#f5f0ff" };
  if (md >= 301  && md <= 315)  return { emoji: "🎨", msg: "Happy Holi! Colour up your knowledge and have a blast!", color: "#ec4899", bg: "#fff0f8" };
  if (md >= 815  && md <= 818)  return { emoji: "🇮🇳", msg: "Happy Independence Day! Be proud, be curious, be Indian!", color: "#f59e0b", bg: "#fffbeb" };
  if (md >= 1101 && md <= 1114) return { emoji: "🎉", msg: "Happy Children's Day! You are the future — keep shining!", color: "#0891b2", bg: "#f0fbff" };
  if (md >= 601  && md <= 615)  return { emoji: "🎒", msg: "Welcome back to school! Let's make this year absolutely amazing!", color: "#6366f1", bg: "#e0e7ff" };
  return null;
}

/* ── Scrolling News Ticker ──────────────────────────────── */
function NewsTicker({ items }) {
  if (!items.length) return null;
  const text = items.map(a => `📢 ${a.text}`).join("     •     ");
  return (
    <div className="news-ticker-wrap">
      <span className="news-ticker-badge">📣 NEWS</span>
      <div className="news-ticker-outer">
        <div className="news-ticker-inner">{text}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;{text}</div>
      </div>
    </div>
  );
}

/* ── App Layout ─────────────────────────────────────────── */
function AppLayout({ children }) {
  const [announcements, setAnnouncements] = useState([]);
  const holiday = getHoliday();

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(6));
    const unsub = onSnapshot(q,
      snap => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => { /* announcements collection may not exist yet */ }
    );
    return unsub;
  }, []);

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">

        {/* School branding header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 10, marginBottom: 14,
          padding: "7px 14px 7px 10px",
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(8px)",
          borderRadius: 16,
          border: "1.5px solid rgba(99,102,241,0.13)",
          boxShadow: "0 2px 10px rgba(99,102,241,0.07)",
        }}>
          <img
            src="/logo.png"
            alt="Vaanavil Vidyalaya"
            style={{
              width: 34, height: 34, borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid rgba(99,102,241,0.3)",
              boxShadow: "0 2px 8px rgba(99,102,241,0.15)",
              flexShrink: 0,
            }}
          />
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'Fredoka One', cursive",
              fontSize: 14, color: "#312e81", lineHeight: 1.1,
            }}>Vaanavil Vidyalaya</div>
            <div style={{
              fontSize: 10, fontWeight: 600,
              color: "#6b7280", letterSpacing: "0.3px",
            }}>Homework Portal ✨</div>
          </div>
        </div>

        {/* Holiday Banner */}
        {holiday && (
          <div style={{
            background: holiday.bg, border: `2px solid ${holiday.color}50`,
            borderRadius: 16, padding: "10px 18px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 12,
            animation: "slideInUp 0.4s ease",
            boxShadow: `0 4px 16px ${holiday.color}20`,
          }}>
            <span style={{ fontSize: 26 }}>{holiday.emoji}</span>
            <span style={{ fontFamily: "'Fredoka One', cursive", color: holiday.color, fontSize: 15 }}>
              {holiday.msg}
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

/* ── Routes ─────────────────────────────────────────────── */
function AppRoutes() {
  const { currentUser, userProfile } = useAuth();

  /* Register FCM token whenever a user is logged in */
  useFCM(currentUser?.uid || null);

  return (
    <Routes>
      <Route path="/login" element={
        currentUser
          ? <Navigate to={userProfile?.role === "driver" ? "/bus-tracker" : "/dashboard"} />
          : <Login />
      } />

      <Route path="/dashboard" element={
        userProfile?.role === "driver"
          ? <Navigate to="/bus-tracker" />
          : <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
      } />
      <Route path="/post-homework" element={
        <ProtectedRoute allowedRoles={["teacher"]}><AppLayout><PostHomework /></AppLayout></ProtectedRoute>
      } />
      <Route path="/submissions" element={
        <ProtectedRoute allowedRoles={["teacher"]}><AppLayout><Submissions /></AppLayout></ProtectedRoute>
      } />
      <Route path="/my-homework" element={
        <ProtectedRoute allowedRoles={["student"]}><AppLayout><MyHomework /></AppLayout></ProtectedRoute>
      } />
      <Route path="/timetable" element={
        <ProtectedRoute allowedRoles={["teacher","student","admin"]}><AppLayout><Timetable /></AppLayout></ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute><AppLayout><AcademicCalendar /></AppLayout></ProtectedRoute>
      } />
      <Route path="/manage-users" element={
        <ProtectedRoute allowedRoles={["admin"]}><AppLayout><ManageUsers /></AppLayout></ProtectedRoute>
      } />
      <Route path="/all-homework" element={
        <ProtectedRoute allowedRoles={["admin"]}><AppLayout><AllHomework /></AppLayout></ProtectedRoute>
      } />
      <Route path="/attendance" element={
        <ProtectedRoute allowedRoles={["teacher","admin"]}><AppLayout><Attendance /></AppLayout></ProtectedRoute>
      } />
      <Route path="/bus-tracker" element={
        <ProtectedRoute><AppLayout><BusTracker /></AppLayout></ProtectedRoute>
      } />
      <Route path="/doubts" element={
        <ProtectedRoute allowedRoles={["student","teacher"]}><AppLayout><DoubtsChannel /></AppLayout></ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

/* ── Root ───────────────────────────────────────────────── */
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: "'Baloo 2', sans-serif",
                fontSize: 14, borderRadius: 14,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              },
              success: { iconTheme: { primary: "#10b981", secondary: "white" } },
              error:   { iconTheme: { primary: "#ef4444", secondary: "white" } },
            }}
          />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}
