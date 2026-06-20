import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { Mail, Lock, Eye, EyeOff, Phone, Calendar } from "lucide-react";
import toast from "react-hot-toast";

/* Emojis that float in the background */
const FLOAT_POOL = ["📚","✏️","⭐","🎨","🔢","🎮","🌈","🏆","🎯","🌟","🦋","🔬","📖","🎵","🎪","🧠","🚀","🌺","🎭","🎈"];

/* Fun facts shown at the bottom of the form */
const FUN_FACTS = [
  "⭐ Did you know? Reading for 20 min a day = 1.8 million words a year!",
  "🧠 Fun fact: Your brain is more active when you sleep than when watching TV!",
  "🚀 Students who submit homework on time score 40% better in exams!",
  "🌍 Fun fact: There are over 7,000 languages spoken in the world!",
  "🔢 Math fact: A googol is 1 followed by 100 zeros!",
  "📚 The world's largest library has 17 million books!",
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return { text: "Burning the midnight oil? 🌙", sub: "You're dedicated! Don't forget to sleep 😴" };
  if (h < 12) return { text: "Good Morning! ☀️",             sub: "Ready to conquer today's challenges? 💪" };
  if (h < 15) return { text: "Good Afternoon! 🌤️",           sub: "Time to be a learning champion! 🏆" };
  if (h < 18) return { text: "Hey there! 🌻",                sub: "Check what homework is due today! 📋" };
  return       { text: "Good Evening! 🌙",                   sub: "Let's finish today's work strong! 🎯" };
}

const DOMAIN = "vaanavilvidyalaya.com";

export default function Login() {
  const [loginType, setLoginType] = useState("student"); // "student" | "staff"

  /* Student fields */
  const [phone, setPhone]     = useState("");
  const [dob, setDob]         = useState("");

  /* Staff fields */
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");

  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleForgotPassword() {
    if (!email.trim()) { toast.error("Please enter your email address first 📧"); return; }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success("Password reset email sent! Check your inbox 📬");
    } catch (e) {
      if (e.code === "auth/user-not-found") toast.error("No account found with this email");
      else toast.error("Failed to send reset email: " + e.message);
    }
    setResetLoading(false);
  }

  const floats = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    emoji:    FLOAT_POOL[i % FLOAT_POOL.length],
    left:     `${5 + (i * 4.8) % 90}%`,
    top:      `${5 + (i * 7.3) % 88}%`,
    duration: `${6 + (i % 5) * 1.5}s`,
    delay:    `${(i * 0.55) % 4}s`,
    size:     i % 3 === 0 ? "2rem" : i % 3 === 1 ? "1.5rem" : "2.4rem",
    opacity:  0.35 + (i % 4) * 0.1,
  })), []);

  const { text: greetText, sub: greetSub } = useMemo(() => getGreeting(), []);
  const funFact = useMemo(() => FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)], []);

  async function handleLogin(e) {
    e.preventDefault();

    let loginEmail = "";
    let loginPassword = "";

    if (loginType === "student") {
      if (!phone || !dob) {
        toast.error("Please enter your phone number and date of birth 📱");
        return;
      }
      if (phone.length !== 10) {
        toast.error("Phone number must be 10 digits 📱");
        return;
      }
      if (dob.length !== 8) {
        toast.error("Date of Birth must be 8 digits — e.g. 14062003 🎂");
        return;
      }
      loginEmail    = `${phone}@${DOMAIN}`;
      loginPassword = dob;
    } else {
      if (!email || !password) {
        toast.error("Please enter your email and password 📧");
        return;
      }
      loginEmail    = email;
      loginPassword = password;
    }

    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast.success("Welcome! Let's go! 🚀");
      navigate("/dashboard");
    } catch (e) {
      console.error("Login error:", e.code, e.message);
      const code = e.code || "";
      if (code === "auth/invalid-api-key" || code === "auth/app-not-authorized") {
        toast.error("Firebase config error — check your .env file 🔧");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error — check your internet connection 🌐");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts — please wait a few minutes ⏳");
      } else if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/wrong-password") {
        if (loginType === "student") {
          toast.error("Wrong phone number or date of birth. Try again! 🔑");
        } else {
          toast.error("Wrong email or password. Try again! 🔑");
        }
      } else {
        toast.error(`Error: ${code || e.message}`);
      }
    }
    setLoading(false);
  }

  return (
    <div className="login-page">

      {/* ════════════════════════════════════════
          LEFT: Hero / Info Panel
      ════════════════════════════════════════ */}
      <div className="login-left" style={{
        background: "linear-gradient(145deg, #312e81 0%, #4f46e5 40%, #7c3aed 70%, #be185d 100%)",
        position: "relative", overflow: "hidden",
      }}>

        {/* Floating emoji background */}
        {floats.map((f, i) => (
          <span key={i} style={{
            position: "absolute", left: f.left, top: f.top,
            fontSize: f.size, pointerEvents: "none", userSelect: "none",
            opacity: f.opacity,
            animation: `loginFloat ${f.duration} ${f.delay} ease-in-out infinite`,
            zIndex: 0,
          }}>{f.emoji}</span>
        ))}

        {/* Dot grid overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "28px 28px", zIndex: 1,
        }} />

        <div className="login-left-content" style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 420 }}>

          {/* School Logo */}
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <img
              src="/logo.png"
              alt="Vaanavil Vidyalaya"
              style={{
                width: 110, height: 110,
                borderRadius: "50%",
                objectFit: "cover",
                border: "4px solid rgba(255,255,255,0.5)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                display: "inline-block",
                animation: "float 4s ease-in-out infinite",
              }}
            />
            <div style={{
              marginTop: 12,
              color: "white",
              fontFamily: "'Fredoka One', cursive",
              fontSize: 24, letterSpacing: "0.5px",
              textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              Vaanavil Vidyalaya
            </div>
            <div style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 13, fontWeight: 600, marginTop: 2,
            }}>
              Homework Portal ✨
            </div>
          </div>

          {/* Time-based greeting */}
          <div style={{ textAlign: "center", margin: "14px 0 6px" }}>
            <p style={{
              color: "#fde68a", fontFamily: "'Fredoka One', cursive",
              fontSize: 20, margin: 0,
            }}>{greetText}</p>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, margin: "4px 0 0" }}>{greetSub}</p>
          </div>

          {/* Hero Title */}
          <h1 className="login-hero-title" style={{
            textAlign: "center", fontSize: 36, marginBottom: 8,
            fontFamily: "'Fredoka One', cursive", fontWeight: 400,
          }}>
            Your Homework,<br />
            <span style={{
              background: "linear-gradient(90deg, #fde68a, #fb923c, #f472b6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>All in One Place! 🌟</span>
          </h1>

          <p className="login-hero-sub" style={{ textAlign: "center", fontSize: 14 }}>
            Teachers post · Students submit · Everyone wins! 🎉
          </p>

          {/* Role cards */}
          <div className="login-role-cards" style={{ marginTop: 24 }}>
            {[
              { emoji: "🛡️", role: "Admin",   desc: "Manage classes & users",    accent: "#fde68a" },
              { emoji: "👩‍🏫", role: "Teacher", desc: "Post & grade homework",     accent: "#86efac" },
              { emoji: "🎒", role: "Student", desc: "View, submit & earn points!", accent: "#93c5fd" },
              { emoji: "🚌", role: "Driver",  desc: "Share live bus location",    accent: "#f9a8d4" },
            ].map((r) => (
              <div key={r.role} className="login-role-card" style={{
                borderLeft: `4px solid ${r.accent}`,
                background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)",
                transition: "transform 0.2s, background 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateX(6px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateX(0)"}
              >
                <span style={{ fontSize: 26 }}>{r.emoji}</span>
                <div>
                  <div className="login-role-card-title" style={{ fontFamily: "'Fredoka One', cursive", fontSize: 17 }}>{r.role}</div>
                  <div className="login-role-card-desc">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          RIGHT: Login Form Panel
      ════════════════════════════════════════ */}
      <div className="login-right" style={{ background: "#fef9ff" }}>
        <div className="login-form-card" style={{ border: "2.5px solid #e0e7ff" }}>

          {/* Top icon + welcome */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 52, marginBottom: 8, display: "block",
              animation: "float 4s ease-in-out infinite",
            }}>🎓</div>
            <h2 style={{
              fontFamily: "'Fredoka One', cursive", fontWeight: 400,
              fontSize: 28, color: "#312e81", marginBottom: 4,
            }}>Welcome Back!</h2>
            <p style={{ color: "#6b7280", fontSize: 14 }}>
              Sign in to continue your learning adventure 🚀
            </p>
          </div>

          {/* ── Login type toggle ── */}
          <div style={{
            display: "flex", gap: 0, marginBottom: 24,
            background: "#f0f4ff", borderRadius: 14, padding: 4,
          }}>
            {[
              { key: "student", label: "🎒 Student",      desc: "Phone + Date of Birth" },
              { key: "staff",   label: "👩‍🏫 Staff",        desc: "Email + Password"     },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setLoginType(key)}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 11,
                  border: "none", cursor: "pointer",
                  fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 700,
                  transition: "all 0.2s",
                  background: loginType === key
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "transparent",
                  color: loginType === key ? "white" : "#6b7280",
                  boxShadow: loginType === key ? "0 4px 12px rgba(99,102,241,0.3)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin}>

            {/* ── STUDENT FIELDS ── */}
            {loginType === "student" && (
              <>
                <div className="form-group">
                  <label>📱 Phone Number</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} style={iconStyle} />
                    <input
                      type="text"
                      placeholder="Enter your 10-digit mobile number"
                      value={phone}
                      maxLength={10}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>🎂 Date of Birth <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>(DDMMYYYY — e.g. 14062003)</span></label>
                  <div style={{ position: "relative" }}>
                    <Calendar size={16} style={iconStyle} />
                    <input
                      type="text"
                      placeholder="e.g. 14062003"
                      value={dob}
                      maxLength={8}
                      onChange={(e) => setDob(e.target.value.replace(/\D/g, ""))}
                      style={{ paddingLeft: 40, letterSpacing: 2 }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "block" }}>
                    💡 Format: Day Month Year — 14 June 2003 → 14062003
                  </span>
                </div>
              </>
            )}

            {/* ── STAFF FIELDS ── */}
            {loginType === "staff" && (
              <>
                <div className="form-group">
                  <label>📧 Email Address</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={iconStyle} />
                    <input type="email" placeholder="your@email.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      style={{ paddingLeft: 40 }} />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ margin: 0 }}>🔒 Password</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#6366f1", fontSize: 12, fontWeight: 700,
                        fontFamily: "inherit", padding: 0,
                      }}
                    >
                      {resetLoading ? "Sending…" : "Forgot Password?"}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={iconStyle} />
                    <input type={showPass ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      style={{ paddingLeft: 40, paddingRight: 40 }} />
                    <button type="button" style={eyeBtnStyle} onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Submit button */}
            <button type="submit" disabled={loading} style={{
              width: "100%", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
              padding: "14px", marginTop: 8,
              fontSize: 17, fontFamily: "'Fredoka One', cursive", fontWeight: 400,
              border: "none", borderRadius: 50, cursor: loading ? "not-allowed" : "pointer",
              background: loading
                ? "#a5b4fc"
                : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
              color: "white",
              boxShadow: loading ? "none" : "0 6px 0 rgba(99,102,241,0.38)",
              transform: "translateY(0)",
              transition: "all 0.12s",
              letterSpacing: "0.3px",
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 9px 0 rgba(99,102,241,0.38)"; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = loading ? "none" : "0 6px 0 rgba(99,102,241,0.38)"; }}
            >
              {loading ? "🚀 Launching..." : "Enter the Portal 🚀"}
            </button>
          </form>

          {/* Hint */}
          <div className="login-hint" style={{
            marginTop: 20,
            background: "linear-gradient(135deg, #f0f4ff, #fce7f3)",
            borderColor: "#c7d2fe",
          }}>
            {loginType === "student"
              ? <><strong>💡 Students:</strong> Use your registered mobile number &amp; DOB (DDMMYYYY) to sign in.</>
              : <><strong>💡 Teachers, Admins &amp; Drivers:</strong> Use your email &amp; password to sign in.</>
            }
          </div>

          {/* Fun fact */}
          <div style={{
            marginTop: 16, padding: "12px 16px",
            background: "#fffbeb", borderRadius: 16,
            border: "2px solid #fde68a",
          }}>
            <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>
              {funFact}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const iconStyle = {
  position: "absolute", left: 13, top: "50%",
  transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none",
};
const eyeBtnStyle = {
  position: "absolute", right: 12, top: "50%",
  transform: "translateY(-50%)", background: "none",
  border: "none", cursor: "pointer", color: "#9ca3af", display: "flex",
};
