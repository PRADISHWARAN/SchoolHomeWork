import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

/*
  profileStatus:
    "idle"    – nobody logged in
    "loading" – fetching the user's profile
    "ok"      – profile loaded
    "missing" – logged in, but no profile exists (account not set up)
    "error"   – couldn't load the profile (usually no internet) → Retry
*/
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]     = useState(null);
  const [userProfile, setUserProfile]     = useState(null);
  const [profileStatus, setProfileStatus] = useState("loading");
  const [loading, setLoading]             = useState(true);
  const profileUid = useRef(null);

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    // onAuthStateChanged below clears the profile
    return signOut(auth);
  }

  async function loadProfile(user) {
    if (!user) {
      profileUid.current = null;
      setUserProfile(null);
      setProfileStatus("idle");
      return;
    }
    // Different account (e.g. twin switch): never show the previous child's profile
    if (profileUid.current !== user.uid) {
      profileUid.current = null;
      setUserProfile(null);
    }
    setProfileStatus("loading");
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (auth.currentUser?.uid !== user.uid) return;   // switched again meanwhile
      if (snap.exists()) {
        profileUid.current = user.uid;
        setUserProfile(snap.data());
        setProfileStatus("ok");
      } else {
        console.warn("No Firestore profile found for uid:", user.uid);
        setProfileStatus("missing");
      }
    } catch (e) {
      console.error("Firestore read failed:", e.code, e.message);
      if (auth.currentUser?.uid !== user.uid) return;
      setProfileStatus("error");
    }
  }

  function reloadProfile() {
    return loadProfile(auth.currentUser);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      await loadProfile(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    profileStatus,
    profileLoading: profileStatus === "loading",
    reloadProfile,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
