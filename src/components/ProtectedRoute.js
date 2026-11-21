import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userProfile, profileStatus, reloadProfile, logout } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Never show pages without a profile — they'd look empty ("No homework!")
  if (!userProfile) {
    if (profileStatus === "loading") {
      return <div className="loader"><div className="spinner" /><span>Loading your account… 🎒</span></div>;
    }
    return <ProfileProblem status={profileStatus} onRetry={reloadProfile} onLogout={logout} />;
  }

  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ProfileProblem({ status, onRetry, onLogout }) {
  const [busy, setBusy] = useState(false);
  const missing = status === "missing";

  async function retry() {
    setBusy(true);
    await onRetry();
    setBusy(false);
  }

  return (
    <div className="profile-problem">
      <div className="profile-problem-card">
        <div style={{ fontSize: 56 }}>{missing ? "🔐" : "📶"}</div>
        <h2>{missing ? "Account not set up yet" : "Couldn't load your account"}</h2>
        <p>
          {missing
            ? "This login has no student or staff profile. Please contact the school office."
            : "Please check your internet connection and try again."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {!missing && (
            <button className="btn btn-primary" onClick={retry} disabled={busy}>
              {busy ? "Trying…" : "🔄 Try again"}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onLogout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
