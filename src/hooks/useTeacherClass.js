import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { sortClasses } from "../utils/classes";

const STORAGE_KEY = "schooldesk.teacherClass";

/**
 * The class a teacher is working with.
 *  - Class teachers: always their own class.
 *  - "All classes" teachers (classId "ALL"): pick a class; the choice is
 *    remembered on this phone and shared by every page that uses this hook.
 */
export function useTeacherClass(userProfile) {
  const isCommon = userProfile?.role === "teacher" && userProfile?.classId === "ALL";
  const [classes, setClasses] = useState([]);
  const [selected, setSelected] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
  });
  const [ready, setReady] = useState(!isCommon);

  useEffect(() => {
    if (!isCommon) { setReady(true); return; }
    let cancelled = false;
    getDocs(query(collection(db, "users"), where("role", "==", "student")))
      .then(snap => {
        if (cancelled) return;
        const list = sortClasses([...new Set(
          snap.docs.map(d => d.data().classId).filter(c => c && c !== "ALL")
        )]);
        setClasses(list);
        setSelected(cur => (list.includes(cur) ? cur : list[0] || ""));
        setReady(true);
      })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [isCommon]);

  function setClassId(c) {
    setSelected(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch { /* private mode */ }
  }

  return {
    isCommon,
    ready,
    classId: isCommon ? selected : userProfile?.classId,
    classes,
    setClassId,
  };
}
