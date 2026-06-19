import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";


/* ── Week number ─────────────────────────────────────── */
function getWeekNumber() {
  const d    = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
}

/* ── Moods ───────────────────────────────────────────── */
const MOODS = [
  { emoji: "😴", label: "Sleepy" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😊", label: "Good" },
  { emoji: "🤩", label: "Amazing!" },
  { emoji: "💪", label: "Pumped!" },
];

/* ── Jokes of the Day ────────────────────────────────── */
const JOKES = [
  { q: "Why did the student eat their homework?",       a: "Because the teacher told them it was a piece of cake! 🎂" },
  { q: "Why is 6 afraid of 7?",                         a: "Because 7 ate (8) 9! 😄" },
  { q: "What do you call a fish without eyes?",         a: "A fsh! 🐟" },
  { q: "Why did the math book look so sad?",            a: "Because it had too many problems! 📚" },
  { q: "What do elves learn at school?",                a: "The elf-abet! 🧝" },
  { q: "Why don't scientists trust atoms?",             a: "Because they make up everything! ⚛️" },
  { q: "What do you call cheese that isn't yours?",     a: "Nacho cheese! 🧀" },
  { q: "Why did the bicycle fall over?",                a: "Because it was two-tired! 🚲" },
  { q: "What do you call a sleeping dinosaur?",         a: "A dino-snore! 🦕" },
  { q: "Why can't Elsa have a balloon?",                a: "Because she'll let it go! 🎈" },
  { q: "What did the ocean say to the beach?",          a: "Nothing, it just waved! 🌊" },
  { q: "Why did the scarecrow win an award?",           a: "Because he was outstanding in his field! 🌾" },
  { q: "What do you call a bear with no teeth?",        a: "A gummy bear! 🐻" },
  { q: "Why did the pencil go to school?",              a: "To get sharper! ✏️" },
];

/* ── Daily Challenges ────────────────────────────────── */
const CHALLENGES = [
  { icon: "🧠", text: "Learn 3 new English words and use them in a sentence!", reward: "Brain Boost" },
  { icon: "🔢", text: "Solve 5 mental math problems without a calculator!", reward: "Math Whiz" },
  { icon: "📖", text: "Read one page of a book and tell someone what it was about!", reward: "Bookworm" },
  { icon: "🌍", text: "Find one interesting fact about another country today!", reward: "Explorer" },
  { icon: "🎨", text: "Draw something that made you happy today!", reward: "Artist" },
  { icon: "🌿", text: "Name 5 plants that grow in your neighborhood!", reward: "Nature Expert" },
  { icon: "💪", text: "Do 10 jumping jacks and take a good stretch break!", reward: "Fitness Star" },
  { icon: "🎵", text: "Hum or sing your favourite song while studying!", reward: "Music Maestro" },
  { icon: "🌤️", text: "Write 3 things you are grateful for today!", reward: "Gratitude Hero" },
  { icon: "🔭", text: "Look up one cool science fact and share it with a friend!", reward: "Science Star" },
  { icon: "🧩", text: "Solve a puzzle or riddle before bedtime tonight!", reward: "Puzzle Pro" },
  { icon: "✍️", text: "Write a short 3-sentence story using your imagination!", reward: "Storyteller" },
  { icon: "🤝", text: "Help a classmate understand something they find difficult!", reward: "Team Hero" },
];

/* ── Greeting ─────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}


/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { userProfile } = useAuth();
  const { themeConfig }  = useTheme();
  const [stats, setStats]                   = useState({});
  const [recentHomework, setRecentHomework] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [announcement, setAnnouncement]     = useState("");
  const [posting, setPosting]               = useState(false);
  const [pendingData, setPendingData]       = useState([]);   // teacher pending tracker
  const [expandedHwIds, setExpandedHwIds]   = useState(new Set());
  const navigate = useNavigate();
  const role = userProfile?.role;

  /* Day-based picks */
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const todayJoke      = JOKES[dayOfYear % JOKES.length];
  const todayChallenge = CHALLENGES[dayOfYear % CHALLENGES.length];

  /* Birthday check (birthday stored as "MM-DD") */
  const today_mmdd = `${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const isBirthday = !!(userProfile?.birthday && userProfile.birthday === today_mmdd);

  useEffect(() => { fetchDashboardData(); }, [userProfile]); // eslint-disable-line

  async function fetchDashboardData() {
    if (!userProfile) { setLoading(false); return; }
    try {
      if (role === "admin") {
        const usersSnap = await getDocs(collection(db, "users"));
        const hwSnap    = await getDocs(collection(db, "homework"));
        const students  = usersSnap.docs.filter(d => d.data().role === "student").length;
        const teachers  = usersSnap.docs.filter(d => d.data().role === "teacher").length;
        setStats({ students, teachers, totalHw: hwSnap.size });
        setRecentHomework(hwSnap.docs.slice(0, 5).map(d => ({ id: d.id, ...d.data() })));

      } else if (role === "teacher") {
        /* ── teacher subject scope ── */
        const teacherSubjects = userProfile?.subjects || ["ALL"];
        const isAllSubjects   = teacherSubjects.includes("ALL") || teacherSubjects.length === 0;

        /* 1. Homework for this class */
        const hwSnap = await getDocs(
          query(collection(db, "homework"), where("classId", "==", userProfile.classId))
        );
        let hw = hwSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!isAllSubjects) {
          hw = hw.filter(h =>
            h.type === "game"
              ? h.teacherId === userProfile.uid
              : teacherSubjects.includes(h.subject)
          );
        }
        hw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        /* 2. Submissions for this class (only for valid homework) */
        const subSnap  = await getDocs(
          query(collection(db, "submissions"), where("classId", "==", userProfile.classId))
        );
        const validHwIds = new Set(hw.map(h => h.id));
        const allSubs    = subSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => validHwIds.has(s.homeworkId));

        /* 3. All students in this class */
        const stuSnap = await getDocs(
          query(collection(db, "users"),
            where("role",    "==", "student"),
            where("classId", "==", userProfile.classId)
          )
        );
        const students = stuSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.name?.localeCompare(b.name));

        /* 4. Build pending tracker (top 6 most-recent homework) */
        const pending = hw.slice(0, 6).map(h => {
          const submittedIds  = new Set(
            allSubs.filter(s => s.homeworkId === h.id).map(s => s.studentId)
          );
          return {
            hw:             h,
            submittedCount: submittedIds.size,
            totalStudents:  students.length,
            pendingStudents: students.filter(s => !submittedIds.has(s.id)),
          };
        });

        setStats({ totalHw: hw.length, submissions: allSubs.length, totalStudents: students.length });
        setRecentHomework(hw.slice(0, 5));
        setPendingData(pending);

      } else if (role === "student") {
        const q       = query(collection(db, "homework"), where("classId", "==", userProfile.classId));
        const snap    = await getDocs(q);
        const hw      = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const subQ    = query(collection(db, "submissions"), where("studentId", "==", userProfile.uid || ""));
        const subSnap = await getDocs(subQ);
        const submittedIds = subSnap.docs.map(d => d.data().homeworkId);
        const pending = hw.filter(h => !submittedIds.includes(h.id));
        setStats({ total: hw.length, submitted: subSnap.size, pending: pending.length });
        setRecentHomework(hw.slice(0, 5));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function postAnnouncement() {
    if (!announcement.trim()) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "announcements"), {
        text:      announcement.trim(),
        createdAt: serverTimestamp(),
        createdBy: userProfile?.name || "Admin",
      });
      setAnnouncement("");
      toast.success("📢 Announcement posted! It will scroll in the ticker.");
    } catch {
      toast.error("Failed to post announcement");
    }
    setPosting(false);
  }

  if (loading) return (
    <div className="loader">
      <div className="spinner" />
      <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: 20 }}>Loading... 🚀</span>
    </div>
  );

  function toggleExpand(hwId) {
    setExpandedHwIds(prev => {
      const next = new Set(prev);
      next.has(hwId) ? next.delete(hwId) : next.add(hwId);
      return next;
    });
  }

  const genderIcon =
    userProfile?.gender === "Female" ? "♀" :
    userProfile?.gender === "Male"   ? "♂" :
    userProfile?.gender === "Other"  ? "⚥" : null;

  const primary = themeConfig?.primary || "#6366f1";

  return (
    <div>

      {/* ── 🎂 Birthday Banner ────────────────────────────── */}
      {isBirthday && (
        <div className="birthday-banner">
          <div className="birthday-title">🎂 Happy Birthday, {userProfile?.name?.split(" ")[0]}! 🎉</div>
          <div className="birthday-sub">
            Wishing you an amazing day full of joy and learning! 🌟 From VaanavilVidyalaya 🦉
          </div>
        </div>
      )}

      {/* ── Profile + Greeting Card ───────────────────────── */}
      <div className="greeting-card" style={{
        display: "flex", alignItems: "center", gap: 18,
        background: "white", borderRadius: 24,
        border: "2.5px solid #e0e7ff",
        padding: "18px 22px", marginBottom: 16,
        boxShadow: "0 6px 24px rgba(99,102,241,0.1)",
        flexWrap: "wrap",
      }}>
        {userProfile?.photoURL ? (
          <img src={userProfile.photoURL} alt={userProfile.name} style={{
            width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
            border: "3px solid #e0e7ff",
            boxShadow: "0 4px 14px rgba(99,102,241,0.2)", flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background:
              role === "teacher" ? "linear-gradient(135deg,#059669,#10b981)" :
              role === "admin"   ? "linear-gradient(135deg,#dc2626,#ef4444)" :
                                  `linear-gradient(135deg,${primary},${primary}bb)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontFamily: "'Fredoka One', cursive",
            fontSize: 30, flexShrink: 0,
            boxShadow: `0 4px 14px ${primary}35`,
          }}>
            {userProfile?.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="greeting-title" style={{ fontSize: 22, fontFamily: "'Fredoka One', cursive", fontWeight: 400, margin: 0 }}>
            {greeting()}, {userProfile?.name?.split(" ")[0]} 👋
          </h1>
          <p style={{ color: "#6b7280", marginTop: 4, fontSize: 13, margin: "4px 0 0" }}>
            {role === "admin"   && "Here's an overview of your school 🏫"}
            {role === "teacher" && `Managing Class ${userProfile?.classId} ✏️`}
            {role === "student" && `Class ${userProfile?.classId} · Let's crush today's work! 💪`}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{
              background: role === "teacher" ? "#d1fae5" : role === "admin" ? "#fee2e2" : "#e0e7ff",
              color:      role === "teacher" ? "#065f46" : role === "admin" ? "#991b1b" : "#3730a3",
              borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
              fontFamily: "'Fredoka One', cursive",
            }}>
              {role === "admin" ? "🛡️ Admin" : role === "teacher" ? "👩‍🏫 Teacher" : "🎒 Student"}
            </span>
            {genderIcon && userProfile?.gender && (
              <span style={{
                background: userProfile.gender === "Female" ? "#fce7f3" : userProfile.gender === "Male" ? "#eff6ff" : "#f3f4f6",
                color:      userProfile.gender === "Female" ? "#be185d" : userProfile.gender === "Male" ? "#1d4ed8" : "#6b7280",
                borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
              }}>
                {genderIcon} {userProfile.gender}
              </span>
            )}
            {userProfile?.classId && userProfile.classId !== "ALL" && (
              <span style={{
                background: "#fef3c7", color: "#92400e",
                borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
              }}>
                📚 Class {userProfile.classId}
              </span>
            )}
          </div>
        </div>
      </div>


      {/* ── Teacher motivational banner ───────────────────── */}
      {role === "teacher" && (
        <>
          <div style={{
            background: "linear-gradient(135deg, #059669, #10b981)",
            borderRadius: 22, padding: "18px 24px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, flexWrap: "wrap",
            boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
          }}>
            <div>
              <div style={{ color: "white", fontFamily: "'Fredoka One', cursive", fontSize: 18 }}>
                🎉 {stats.totalHw || 0} assignments posted · {stats.submissions || 0} submissions received!
              </div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>
                👥 {stats.totalStudents || 0} students in Class {userProfile?.classId}
              </div>
            </div>
            <button className="btn" onClick={() => navigate("/post-homework")}
              style={{ background: "white", color: "#059669", fontFamily: "'Fredoka One', cursive" }}>
              ✏️ Post New
            </button>
          </div>

          {/* ── ⚠️ Pending Submissions Tracker ── */}
          {pendingData.length > 0 && (
            <div style={{
              background: "white", borderRadius: 22,
              border: "2.5px solid #e0e7ff",
              padding: "22px 24px", marginBottom: 20,
              boxShadow: "0 6px 24px rgba(99,102,241,0.08)",
            }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <h2 style={{
                    fontFamily: "'Fredoka One', cursive", fontWeight: 400,
                    fontSize: 20, margin: 0, color: "#1e1b4b",
                  }}>
                    ⚠️ Pending Submissions
                  </h2>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
                    Click any homework to see which students haven't submitted
                  </p>
                </div>
                <button className="btn btn-secondary"
                  onClick={() => navigate("/submissions")}
                  style={{ fontSize: 13, padding: "7px 16px", fontFamily: "'Fredoka One', cursive" }}>
                  Full View →
                </button>
              </div>

              {/* Homework rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingData.map(({ hw, submittedCount, totalStudents, pendingStudents }) => {
                  const pct      = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
                  const isExpanded = expandedHwIds.has(hw.id);
                  const allDone  = pendingStudents.length === 0;

                  return (
                    <div key={hw.id} style={{
                      border: `1.5px solid ${allDone ? "#6ee7b7" : pendingStudents.length > 0 ? "#fecaca" : "#e0e7ff"}`,
                      borderRadius: 16,
                      overflow: "hidden",
                      transition: "all 0.2s",
                    }}>
                      {/* Row header — always visible */}
                      <div
                        onClick={() => toggleExpand(hw.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "14px 18px", cursor: "pointer",
                          background: allDone ? "#f0fdf4" : "#fff5f5",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = allDone ? "#dcfce7" : "#fee2e2"}
                        onMouseLeave={e => e.currentTarget.style.background = allDone ? "#f0fdf4" : "#fff5f5"}
                      >
                        {/* Subject emoji */}
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                          background: allDone ? "#d1fae5" : "#fee2e2",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 22,
                        }}>
                          {hw.type === "game" ? "🎮" : "📝"}
                        </div>

                        {/* Title + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 700, fontSize: 15,
                            color: "#1e1b4b", marginBottom: 2,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {hw.title}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {hw.subject || "Game"} · Due: {hw.dueDate || "—"}
                          </div>
                          {/* Mini progress bar */}
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8, marginTop: 6,
                          }}>
                            <div style={{
                              flex: 1, background: "#e0e7ff", borderRadius: 50, height: 6, overflow: "hidden",
                            }}>
                              <div style={{
                                width: `${pct}%`, height: "100%", borderRadius: 50,
                                background: allDone
                                  ? "linear-gradient(90deg,#10b981,#34d399)"
                                  : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                                transition: "width 0.8s ease",
                              }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>
                              {submittedCount}/{totalStudents}
                            </span>
                          </div>
                        </div>

                        {/* Status badge + chevron */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                          {allDone ? (
                            <span style={{
                              background: "#d1fae5", color: "#059669",
                              fontWeight: 700, fontSize: 12,
                              padding: "4px 12px", borderRadius: 50,
                            }}>✅ All Done!</span>
                          ) : (
                            <span style={{
                              background: "#fee2e2", color: "#dc2626",
                              fontWeight: 700, fontSize: 12,
                              padding: "4px 12px", borderRadius: 50,
                            }}>❌ {pendingStudents.length} pending</span>
                          )}
                          <span style={{ fontSize: 14, color: "#9ca3af", transition: "transform 0.2s",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                            ▼
                          </span>
                        </div>
                      </div>

                      {/* Expanded student list */}
                      {isExpanded && (
                        <div style={{ padding: "0 18px 16px", background: "white" }}>
                          {allDone ? (
                            <div style={{
                              textAlign: "center", padding: "16px 0",
                              color: "#059669", fontFamily: "'Fredoka One', cursive", fontSize: 16,
                            }}>
                              🎉 Every student submitted this homework! Great class!
                            </div>
                          ) : (
                            <>
                              <div style={{
                                fontSize: 13, fontWeight: 700, color: "#dc2626",
                                padding: "10px 0 8px",
                                borderBottom: "1px solid #fee2e2", marginBottom: 10,
                              }}>
                                ⏳ {pendingStudents.length} student{pendingStudents.length > 1 ? "s" : ""} yet to submit:
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {pendingStudents.map((stu) => (
                                  <div key={stu.id} style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    background: "#fff5f5", border: "1.5px solid #fecaca",
                                    borderRadius: 50, padding: "5px 14px 5px 8px",
                                  }}>
                                    <div style={{
                                      width: 28, height: 28, borderRadius: "50%",
                                      background: "#fee2e2", color: "#ef4444",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontWeight: 800, fontSize: 12, flexShrink: 0,
                                    }}>
                                      {stu.name?.[0]?.toUpperCase()}
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                                      {stu.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingData.length === 0 && !loading && (
            <div style={{
              background: "#f0fdf4", border: "2px solid #6ee7b7",
              borderRadius: 16, padding: "16px 20px", marginBottom: 20,
              textAlign: "center", color: "#059669",
              fontFamily: "'Fredoka One', cursive", fontSize: 15,
            }}>
              🎉 No homework posted yet — post your first assignment to start tracking!
            </div>
          )}
        </>
      )}

      {/* ── Stat Cards ────────────────────────────────────── */}
      <div className="stat-grid">
        {role === "admin" && (<>
          <StatCard emoji="🧒" bg="#e0e7ff" color="#4338ca" label="Students"       value={stats.students  || 0} onClick={() => navigate("/manage-users")} />
          <StatCard emoji="👩‍🏫" bg="#d1fae5" color="#059669" label="Teachers"       value={stats.teachers  || 0} onClick={() => navigate("/manage-users")} />
          <StatCard emoji="📚" bg="#fef3c7" color="#d97706" label="Total Homework"  value={stats.totalHw   || 0} onClick={() => navigate("/all-homework")} />
        </>)}
        {role === "teacher" && (<>
          <StatCard emoji="📋" bg="#e0e7ff" color="#4338ca" label="Posted"         value={stats.totalHw     || 0} />
          <StatCard emoji="✅" bg="#d1fae5" color="#059669" label="Submissions"    value={stats.submissions  || 0} />
        </>)}
        {role === "student" && (<>
          <StatCard emoji="📚" bg="#e0e7ff" color="#4338ca" label="Total"     value={stats.total    || 0} />
          <StatCard emoji="✅" bg="#d1fae5" color="#059669" label="Submitted" value={stats.submitted || 0} />
          <StatCard emoji="⏳" bg="#fef3c7" color="#b45309" label="Pending"   value={stats.pending  || 0} />
        </>)}
      </div>


      {/* ── 📢 Admin: Post Announcement ───────────────────── */}
      {role === "admin" && (
        <div style={{
          background: "white", borderRadius: 22, border: "2.5px solid #e0e7ff",
          padding: "22px 24px", marginBottom: 24,
          boxShadow: "0 6px 24px rgba(99,102,241,0.08)",
        }}>
          <h2 style={{ fontFamily: "'Fredoka One', cursive", fontSize: 20, fontWeight: 400, marginBottom: 6 }}>
            📢 Post Announcement
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
            Announcements scroll in the news ticker for everyone in the school.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="e.g. School Sports Day is on Friday! 🏃 Everyone, bring your PE kit."
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              onKeyDown={e => e.key === "Enter" && postAnnouncement()}
              style={{
                flex: 1, minWidth: "180px", padding: "12px 16px", borderRadius: 14,
                border: "2px solid #e0e7ff",
                fontFamily: "'Baloo 2', sans-serif", fontSize: 14,
                outline: "none", transition: "border 0.2s",
              }}
              onFocus={e => (e.target.style.borderColor = "#6366f1")}
              onBlur={e  => (e.target.style.borderColor = "#e0e7ff")}
            />
            <button
              className="btn btn-primary"
              onClick={postAnnouncement}
              disabled={posting || !announcement.trim()}
              style={{ whiteSpace: "nowrap", fontFamily: "'Fredoka One', cursive" }}
            >
              {posting ? "Posting..." : "📣 Post"}
            </button>
          </div>
        </div>
      )}

      {/* ── Recent Homework (student & teacher only) ─────── */}
      {role !== "admin" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontFamily: "'Fredoka One', cursive", fontWeight: 400 }}>
              {role === "student" ? "📝 Recent Homework" : "🕐 Recently Posted"}
            </h2>
            <button className="btn btn-secondary"
              onClick={() => navigate(role === "student" ? "/my-homework" : "/post-homework")}
              style={{ fontSize: 13, padding: "7px 16px", fontFamily: "'Fredoka One', cursive" }}>
              View All →
            </button>
          </div>

          {recentHomework.length === 0 ? (
            <div className="empty-fun">
              <span className="empty-fun-emoji">📭</span>
              <h3>Nothing here yet!</h3>
              <p>{role === "teacher" ? "Post your first homework assignment! ✏️" : "No homework yet — enjoy the break! 🎉"}</p>
            </div>
          ) : (
            recentHomework.map(hw => <HomeworkRow key={hw.id} hw={hw} />)
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────── */
function StatCard({ emoji, bg, color, label, value, onClick }) {
  return (
    <div className="stat-card" onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(99,102,241,0.15)"; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; } }}
    >
      <div className="stat-icon" style={{ background: bg, color, fontSize: 26 }}>{emoji}</div>
      <div>
        <div className="stat-label" style={{ fontFamily: "'Baloo 2', sans-serif" }}>{label}</div>
        <div className="stat-value" style={{ fontFamily: "'Fredoka One', cursive", fontWeight: 400 }}>{value}</div>
      </div>
    </div>
  );
}

function HomeworkRow({ hw }) {
  const dueDate  = hw.dueDate
    ? new Date(hw.dueDate + (hw.dueTime ? `T${hw.dueTime}` : "T23:59"))
    : null;
  const isOverdue = dueDate && dueDate < new Date();
  const isGame    = hw.type === "game";
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 0", borderBottom: "1.5px solid #f3f4f6", gap: 12, flexWrap: "wrap",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{isGame ? "🎮" : "📝"}</span>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Fredoka One', cursive" }}>{hw.title}</div>
        </div>
        <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
          {hw.subject} · Class {hw.classId}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {dueDate && (
          <span style={{ fontSize: 12, color: isOverdue ? "#ef4444" : "#6b7280" }}>
            📅 {dueDate.toLocaleDateString()}{hw.dueTime && ` · ⏰ ${new Date(`2000-01-01T${hw.dueTime}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </span>
        )}
        <span className={`badge ${isOverdue ? "badge-red" : isGame ? "badge-game" : "badge-blue"}`}>
          {isOverdue ? "Overdue" : isGame ? "🎮 Game" : "Active"}
        </span>
      </div>
    </div>
  );
}
