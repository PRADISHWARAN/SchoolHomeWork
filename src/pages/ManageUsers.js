import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, deleteDoc, doc, setDoc, updateDoc, serverTimestamp, query, where } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, firebaseConfig } from "../firebase/config";
import { Plus, Trash2, Users, X, Camera, Pencil } from "lucide-react";
import toast from "react-hot-toast";

/* Secondary Firebase app used ONLY for creating new accounts
   so the admin stays logged in during user creation */
function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === "secondary");
  const app = existing || initializeApp(firebaseConfig, "secondary");
  return getAuth(app);
}

const CLASSES   = ["Pre-KG-A", "Pre-KG-B", "LKG-A", "LKG-B", "UKG-A", "UKG-B", "1st-A", "1st-B", "2nd-A", "2nd-B", "3rd-A", "3rd-B", "4th-A", "4th-B", "5th-A", "5th-B", "6th-A", "6th-B", "7th-A", "7th-B", "8th-A", "8th-B", "9th-A", "9th-B", "10th-A", "10th-B"];
const ROLES     = ["student", "teacher", "admin", "driver"];
const GENDERS   = ["Male", "Female", "Other"];
const SUBJECTS  = ["Mathematics","English","Science","Social Studies","Hindi","Tamil","Computer","Drawing","EVS","General Knowledge"];

/* ─── Avatar helper ─────────────────────────────────────────────── */
function UserAvatar({ user, size = 36 }) {
  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", border: "2.5px solid #e0e7ff", flexShrink: 0,
        }}
      />
    );
  }
  const gColors =
    user?.gender === "Female" ? { bg: "#fce7f3", color: "#be185d" } :
    user?.gender === "Male"   ? { bg: "#e0e7ff", color: "#4f46e5" } :
                                { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: gColors.bg, color: gColors.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.4, flexShrink: 0,
    }}>
      {user?.name?.[0]?.toUpperCase() || "U"}
    </div>
  );
}

/* ─── Gender badge ───────────────────────────────────────────────── */
function GenderBadge({ gender }) {
  if (!gender) return null;
  const map = {
    Male:   { icon: "♂", color: "#4f46e5", bg: "#e0e7ff" },
    Female: { icon: "♀", color: "#be185d", bg: "#fce7f3" },
    Other:  { icon: "⚥", color: "#6b7280", bg: "#f3f4f6" },
  };
  const g = map[gender] || map.Other;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: g.bg, color: g.color,
      borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    }}>
      {g.icon} {gender}
    </span>
  );
}

/* ─── Photo upload circle (reused in both modals) ───────────────── */
function PhotoUploadCircle({ preview, currentURL, inputRef, onChange }) {
  const displaySrc = preview || currentURL;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          width: 90, height: 90, borderRadius: "50%",
          background: displaySrc ? "transparent" : "#f0f4ff",
          border: "2.5px dashed #a5b4fc",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden",
        }}
        title="Click to upload photo"
      >
        {displaySrc ? (
          <img src={displaySrc} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center" }}>
            <Camera size={26} color="#a5b4fc" />
            <div style={{ fontSize: 10, color: "#a5b4fc", marginTop: 4, fontWeight: 700 }}>ADD PHOTO</div>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" ref={inputRef} onChange={onChange} style={{ display: "none" }} />
      <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
        {displaySrc ? "Click to change photo · max 5 MB" : "Optional · JPG, PNG, GIF · max 5 MB"}
      </span>
    </div>
  );
}

/* ─── Subject picker (used in Add / Edit teacher modals) ────────── */
function SubjectPicker({ value = ["ALL"], onChange }) {
  const isAll = value.includes("ALL");
  return (
    <div className="form-group">
      <label>📚 Subjects Handled *</label>

      {/* All-subjects toggle */}
      <div
        onClick={() => onChange(isAll ? [] : ["ALL"])}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
          border: `2px solid ${isAll ? "#6366f1" : "#e0e7ff"}`,
          borderRadius: 12, cursor: "pointer", marginBottom: 10,
          background: isAll ? "#e0e7ff" : "#f9fafb", transition: "all 0.15s",
        }}
      >
        <input type="checkbox" checked={isAll} readOnly
          style={{ width: 16, height: 16, accentColor: "#6366f1", pointerEvents: "none" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: isAll ? "#4f46e5" : "#374151" }}>
            🏫 All Subjects — Single Class Teacher
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>This teacher manages all subjects for the class</div>
        </div>
      </div>

      {/* Individual subject checkboxes */}
      {!isAll && (
        <>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 600 }}>
            Select subjects this teacher handles:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUBJECTS.map((sub) => {
              const selected = value.includes(sub);
              return (
                <button
                  key={sub} type="button"
                  onClick={() => {
                    const next = selected
                      ? value.filter((s) => s !== sub)
                      : [...value, sub];
                    onChange(next);
                  }}
                  style={{
                    padding: "6px 14px", borderRadius: 50, fontSize: 13,
                    fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `2px solid ${selected ? "#6366f1" : "#e0e7ff"}`,
                    background: selected ? "#6366f1" : "white",
                    color: selected ? "white" : "#6b7280",
                  }}
                >
                  {selected ? "✓ " : ""}{sub}
                </button>
              );
            })}
          </div>
          {value.filter((s) => s !== "ALL").length === 0 && (
            <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
              ⚠️ Please select at least one subject
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function ManageUsers() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [classFilter, setClassFilter] = useState("All");

  /* ── Create modal state ── */
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating]         = useState(false);
  const [addPhotoFile, setAddPhotoFile] = useState(null);
  const [addPhotoPreview, setAddPhotoPreview] = useState(null);
  const addPhotoRef = useRef();
  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "", phone: "", dob: "",
    role: "student", classId: "LKG-A", gender: "Male", birthday: "", subjects: ["ALL"],
  });

  /* ── Edit modal state ── */
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editingUser, setEditingUser]       = useState(null);   // full user object
  const [saving, setSaving]                 = useState(false);
  const [editPhotoFile, setEditPhotoFile]   = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const editPhotoRef = useRef();
  const [editForm, setEditForm] = useState({
    name: "", role: "student", classId: "LKG-A", gender: "Male", birthday: "", subjects: ["ALL"],
  });

  useEffect(() => { fetchUsers(); }, []);

  /* ── Fetch users ── */
  async function fetchUsers() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name?.localeCompare(b.name));
      setUsers(list);
    } catch {
      toast.error("Failed to load users");
    }
    setLoading(false);
  }

  /* ── Photo change helper (shared) ── */
  function makePhotoHandler(setFile, setPreview) {
    return (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
      if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
      setFile(file);
      setPreview(URL.createObjectURL(file));
    };
  }

  /* ══════════════════════════════════════
     CREATE (Add) handlers
  ══════════════════════════════════════ */
  const DOMAIN = "vaanavilvidyalaya.com";

  function closeAddModal() {
    setShowAddModal(false);
    setAddPhotoFile(null);
    setAddPhotoPreview(null);
    setAddForm({ name: "", email: "", password: "", phone: "", dob: "", role: "student", classId: "LKG-A", gender: "Male", birthday: "", subjects: ["ALL"] });
  }

  async function handleCreate() {
    const isStudent = addForm.role === "student";
    const isTeacher = addForm.role === "teacher";

    if (isStudent) {
      if (!addForm.name || !addForm.phone || !addForm.dob) {
        toast.error("Please fill Name, Phone Number and Date of Birth"); return;
      }
      if (addForm.phone.length !== 10) {
        toast.error("Phone number must be exactly 10 digits"); return;
      }
      if (addForm.dob.length !== 8) {
        toast.error("Date of Birth must be 8 digits — e.g. 14062003"); return;
      }
    } else {
      if (!addForm.name || !addForm.email || !addForm.password) {
        toast.error("Please fill all required fields"); return;
      }
      if (addForm.password.length < 6) {
        toast.error("Password must be at least 6 characters"); return;
      }
    }
    if (isTeacher && !addForm.subjects.includes("ALL") && addForm.subjects.length === 0) {
      toast.error("Please select at least one subject for this teacher"); return;
    }

    const authEmail    = isStudent ? `${addForm.phone}@${DOMAIN}` : addForm.email;
    const authPassword = isStudent ? addForm.dob                  : addForm.password;

    setCreating(true);
    try {
      const secondaryAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, authPassword);

      let photoURL = "";
      if (addPhotoFile) {
        const ref = storageRef(storage, `profilePhotos/${cred.user.uid}`);
        await uploadBytes(ref, addPhotoFile);
        photoURL = await getDownloadURL(ref);
      }

      try {
        await setDoc(doc(db, "users", cred.user.uid), {
          name:      addForm.name,
          email:     authEmail,
          ...(isStudent ? { phone: addForm.phone, dob: addForm.dob } : {}),
          ...(isTeacher ? { subjects: addForm.subjects.length > 0 ? addForm.subjects : ["ALL"] } : {}),
          role:      addForm.role,
          classId:   addForm.role === "admin" ? "ALL" : addForm.role === "driver" ? "DRIVER" : addForm.classId,
          gender:    addForm.gender,
          birthday:  addForm.birthday || "",
          photoURL,
          uid:       cred.user.uid,
          createdAt: new Date().toISOString(),
          classJoinedAt: serverTimestamp(),
        });
        toast.success(`${addForm.role} account created for ${addForm.name}! 🎉`);
        closeAddModal();
        fetchUsers();
      } catch (firestoreErr) {
        // Rollback: delete the Auth account so the admin can retry
        await cred.user.delete();
        throw firestoreErr;
      } finally {
        // Sign out from secondary app — does NOT affect the admin's main session
        await signOut(secondaryAuth);
      }
    } catch (e) {
      if (e.code === "auth/email-already-in-use") toast.error("This phone number is already registered");
      else toast.error("Failed to create user: " + e.message);
    }
    setCreating(false);
  }

  /* ══════════════════════════════════════
     EDIT handlers
  ══════════════════════════════════════ */
  function openEditModal(user) {
    setEditingUser(user);
    setEditForm({
      name:     user.name     || "",
      role:     user.role     || "student",
      classId:  user.classId  || "LKG-A",
      gender:   user.gender   || "Male",
      birthday: user.birthday || "",
      subjects: user.subjects || ["ALL"],
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setShowEditModal(true);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditingUser(null);
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
  }

  async function handleUpdate() {
    if (!editForm.name.trim()) { toast.error("Name cannot be empty"); return; }
    setSaving(true);
    try {
      /* Upload new photo if picked */
      let photoURL = editingUser.photoURL || "";
      if (editPhotoFile) {
        const ref = storageRef(storage, `profilePhotos/${editingUser.uid || editingUser.id}`);
        await uploadBytes(ref, editPhotoFile);
        photoURL = await getDownloadURL(ref);
      }

      const classChanged = editForm.role === "student" && editForm.classId !== editingUser.classId;

      await updateDoc(doc(db, "users", editingUser.id), {
        name:     editForm.name.trim(),
        role:     editForm.role,
        classId:  editForm.role === "admin" ? "ALL" : editForm.role === "driver" ? "DRIVER" : editForm.classId,
        gender:   editForm.gender,
        birthday: editForm.birthday || "",
        photoURL,
        ...(editForm.role === "teacher"
          ? { subjects: editForm.subjects.length > 0 ? editForm.subjects : ["ALL"] }
          : {}),
        ...(classChanged ? { classJoinedAt: serverTimestamp() } : {}),
      });

      toast.success(`${editForm.name}'s profile updated! ✏️`);
      closeEditModal();
      fetchUsers();
    } catch (e) {
      toast.error("Failed to update: " + e.message);
    }
    setSaving(false);
  }

  /* ── Delete ── */
  async function handleDelete(userId, userName) {
    if (!window.confirm(`Delete ${userName}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      toast.success("User removed");
      fetchUsers();
    } catch {
      toast.error("Failed to delete user");
    }
  }

  /* ── Search ── */
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Derived ── */
  const roleFiltered = filter === "all" ? users : users.filter((u) => u.role === filter);

  /* Classes that actually have users under the current role tab */
  const availableClasses = ["All", ...CLASSES.filter((c) =>
    roleFiltered.some((u) => u.classId === c)
  )];

  /* Apply class filter + search on top of role filter */
  const filtered = roleFiltered
    .filter((u) => classFilter === "All" || u.classId === classFilter)
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (u.name || "").toLowerCase().includes(q) ||
             (u.phone || "").includes(q) ||
             (u.email || "").toLowerCase().includes(q);
    });

  const counts = {
    all:     users.length,
    student: users.filter((u) => u.role === "student").length,
    teacher: users.filter((u) => u.role === "teacher").length,
    admin:   users.filter((u) => u.role === "admin").length,
  };

  if (loading) return <div className="loader"><div className="spinner" /><span>Loading...</span></div>;

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manage Users</h1>
          <p>{users.length} total users in the system</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Add User
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="🔍 Search by name, phone or email…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: "100%", padding: "11px 16px", borderRadius: 14,
            border: "2px solid #e0e7ff", fontFamily: "'Poppins', sans-serif",
            fontSize: 14, outline: "none", boxSizing: "border-box",
          }}
          onFocus={e => (e.target.style.borderColor = "#6366f1")}
          onBlur={e  => (e.target.style.borderColor = "#e0e7ff")}
        />
      </div>

      {/* Role Filter Tabs */}
      <div style={styles.tabs}>
        {Object.entries(counts).map(([key, count]) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setClassFilter("All"); }}
            style={{ ...styles.tab, ...(filter === key ? styles.tabActive : {}) }}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)} ({count})
          </button>
        ))}
      </div>

      {/* Class Filter Pills — shown whenever there are classes to pick from */}
      {availableClasses.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginRight: 4 }}>
            🏫 Class:
          </span>
          {availableClasses.map((c) => (
            <button
              key={c}
              onClick={() => setClassFilter(c)}
              style={{
                padding: "5px 14px", borderRadius: 50,
                border: `1.5px solid ${classFilter === c ? "#4f46e5" : "#e0e7ff"}`,
                background: classFilter === c ? "#4f46e5" : "white",
                color: classFilter === c ? "white" : "#6b7280",
                cursor: "pointer", fontFamily: "'Poppins', sans-serif",
                fontSize: 13, fontWeight: 600, transition: "all 0.18s",
              }}
            >
              {c === "All" ? "All Classes" : c}
            </button>
          ))}
          {classFilter !== "All" && (
            <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 4 }}>
              — {filtered.length} user{filtered.length !== 1 ? "s" : ""} in {classFilter}
            </span>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <div className="card empty-state">
          <Users size={52} />
          <h3>No users found</h3>
          <p>Click "Add User" to create the first user</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="card user-table-wrap" style={{ padding: 0, overflow: "hidden" }}>
            <table style={styles.table}>
              <thead>
                <tr style={{ background: "#f5f7ff" }}>
                  {["Name", "Email / Phone", "Role", "Gender", "Class", "🎂 Birthday", "Actions"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <UserAvatar user={user} size={36} />
                        <span style={{ fontWeight: 600 }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      {user.role === "student" && user.phone
                        ? <span style={{ fontSize: 13, color: "#6b7280" }}>📱 {user.phone}</span>
                        : <span style={{ fontSize: 13, color: "#6b7280" }}>{user.email}</span>
                      }
                    </td>
                    <td style={styles.td}>
                      <span className={`badge ${user.role === "admin" ? "badge-red" : user.role === "teacher" ? "badge-blue" : "badge-green"}`}>
                        {user.role}
                      </span>
                      {user.role === "teacher" && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>
                          {(user.subjects || ["ALL"]).includes("ALL")
                            ? <span style={{ color: "#059669", fontWeight: 700 }}>🏫 All Subjects</span>
                            : (user.subjects || []).map((s) => (
                                <span key={s} style={{
                                  display: "inline-block", background: "#e0e7ff",
                                  color: "#4f46e5", borderRadius: 50,
                                  padding: "1px 7px", marginRight: 3, marginTop: 2,
                                  fontWeight: 600, fontSize: 10,
                                }}>{s}</span>
                              ))
                          }
                        </div>
                      )}
                    </td>
                    <td style={styles.td}><GenderBadge gender={user.gender} /></td>
                    <td style={styles.td}><span style={{ fontWeight: 600 }}>{user.classId}</span></td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 13, color: user.birthday ? "#be185d" : "#9ca3af" }}>
                        {user.birthday ? `🎂 ${user.birthday}` : "—"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn"
                          onClick={() => openEditModal(user)}
                          style={styles.editBtn}
                          title="Edit user"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(user.id, user.name)}
                          style={{ padding: "5px 12px", fontSize: 12 }}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="user-card-list">
            {filtered.map((user) => (
              <div key={user.id} style={styles.mobileCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <UserAvatar user={user} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.role === "student" && user.phone ? `📱 ${user.phone}` : user.email}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`badge ${user.role === "admin" ? "badge-red" : user.role === "teacher" ? "badge-blue" : "badge-green"}`}>
                      {user.role}
                    </span>
                    <GenderBadge gender={user.gender} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#6b7280" }}>📚 {user.classId}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      onClick={() => openEditModal(user)}
                      style={styles.editBtn}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(user.id, user.name)}
                      style={{ padding: "6px 14px", fontSize: 13 }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ADD USER MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h2 className="modal-title">Add New User</h2>
              <button onClick={closeAddModal} style={styles.closeBtn}><X size={18} /></button>
            </div>

            <PhotoUploadCircle
              preview={addPhotoPreview}
              currentURL={null}
              inputRef={addPhotoRef}
              onChange={makePhotoHandler(setAddPhotoFile, setAddPhotoPreview)}
            />

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text" placeholder="e.g. Priya Sharma"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </div>

            {/* ── Student: Phone + DOB ── */}
            {addForm.role === "student" ? (
              <>
                <div className="form-group">
                  <label>📱 Phone Number * <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>(10 digits — used to login)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={addForm.phone}
                    maxLength={10}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
                <div className="form-group">
                  <label>🎂 Date of Birth * <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>(DDMMYYYY — used as password)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 14062003"
                    value={addForm.dob}
                    maxLength={8}
                    onChange={(e) => setAddForm({ ...addForm, dob: e.target.value.replace(/\D/g, "") })}
                  />
                  <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "block" }}>
                    💡 14 June 2003 → 14062003
                  </span>
                </div>
              </>
            ) : (
              /* ── Teacher / Admin: Email + Password ── */
              <>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email" placeholder="e.g. teacher@school.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Password * (min 6 chars)</label>
                  <input
                    type="password" placeholder="Set a password for them"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              <div className="form-group">
                <label>Role *</label>
                <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              {addForm.role !== "admin" && addForm.role !== "driver" && (
                <div className="form-group">
                  <label>Class *</label>
                  <select value={addForm.classId} onChange={(e) => setAddForm({ ...addForm, classId: e.target.value })}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Gender *</label>
                <select value={addForm.gender} onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* ── Subject picker for teachers ── */}
            {addForm.role === "teacher" && (
              <SubjectPicker
                value={addForm.subjects}
                onChange={(s) => setAddForm({ ...addForm, subjects: s })}
              />
            )}

            <div className="form-group">
              <label>🎂 Birthday (optional — for birthday greeting!)</label>
              <input
                type="text"
                placeholder="MM-DD  e.g. 09-25 for September 25th"
                value={addForm.birthday}
                maxLength={5}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^0-9-]/g, "");
                  if (v.length === 2 && !v.includes("-")) v = v + "-";
                  setAddForm({ ...addForm, birthday: v });
                }}
              />
            </div>

            <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#4f46e5" }}>
              {addForm.role === "student"
                ? <>💡 <strong>Student Login:</strong> They will sign in using their <strong>Phone Number</strong> as username and <strong>Date of Birth (DDMMYYYY)</strong> as password.</>
                : <>💡 <strong>Note:</strong> The user will log in with this email and password. Make sure to share it with them.</>
              }
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={closeAddModal} style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating} style={{ flex: 2, justifyContent: "center" }}>
                {creating ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          EDIT USER MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Edit User</h2>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                  {editingUser.email}
                </p>
              </div>
              <button onClick={closeEditModal} style={styles.closeBtn}><X size={18} /></button>
            </div>

            {/* ── Photo ── */}
            <PhotoUploadCircle
              preview={editPhotoPreview}
              currentURL={editingUser.photoURL}
              inputRef={editPhotoRef}
              onChange={makePhotoHandler(setEditPhotoFile, setEditPhotoPreview)}
            />

            {/* ── Name ── */}
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text" placeholder="Full name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            {/* ── Email (read-only display) ── */}
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={editingUser.email}
                readOnly
                style={{ background: "#f9fafb", color: "#9ca3af", cursor: "not-allowed" }}
              />
              <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "block" }}>
                🔒 Email cannot be changed here
              </span>
            </div>

            {/* ── Role + Class + Gender ── */}
            <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              <div className="form-group">
                <label>Role *</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>

              {editForm.role !== "admin" && editForm.role !== "driver" && (
                <div className="form-group">
                  <label>Class *</label>
                  <select value={editForm.classId} onChange={(e) => setEditForm({ ...editForm, classId: e.target.value })}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Gender *</label>
                <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* ── Subject picker for teachers ── */}
            {editForm.role === "teacher" && (
              <SubjectPicker
                value={editForm.subjects}
                onChange={(s) => setEditForm({ ...editForm, subjects: s })}
              />
            )}

            {/* ── Birthday ── */}
            <div className="form-group">
              <label>🎂 Birthday (optional — for birthday greeting!)</label>
              <input
                type="text"
                placeholder="MM-DD  e.g. 09-25 for September 25th"
                value={editForm.birthday}
                maxLength={5}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^0-9-]/g, "");
                  if (v.length === 2 && !v.includes("-")) v = v + "-";
                  setEditForm({ ...editForm, birthday: v });
                }}
              />
            </div>

            {/* ── Promote/Demote hint ── */}
            {editForm.role !== "admin" && (
              <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
                🏫 <strong>Promoting a student?</strong> Just change the class above — e.g. from <strong>3rd-A → 4th-A</strong>. The student will automatically see homework for their new class.
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={closeEditModal} style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={saving} style={{ flex: 2, justifyContent: "center" }}>
                {saving ? "Saving..." : "✏️ Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */
const styles = {
  tabs: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  tab: {
    padding: "8px 18px", borderRadius: 50,
    border: "1.5px solid #e0e7ff", background: "white",
    cursor: "pointer", fontFamily: "'Poppins', sans-serif",
    fontSize: 13, fontWeight: 600, color: "#6b7280", transition: "all 0.2s",
  },
  tabActive: { background: "#4f46e5", color: "white", borderColor: "#4f46e5" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    padding: "12px 20px", textAlign: "left", fontSize: 12,
    fontWeight: 700, color: "#6b7280", textTransform: "uppercase",
    letterSpacing: "0.05em", borderBottom: "1.5px solid #e0e7ff",
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "13px 20px", verticalAlign: "middle" },
  closeBtn: {
    background: "#f3f4f6", border: "none", borderRadius: 8,
    padding: 7, cursor: "pointer", display: "flex", alignItems: "center", color: "#374151",
  },
  editBtn: {
    padding: "5px 12px", fontSize: 12,
    background: "#f0f4ff", color: "#4f46e5",
    border: "1.5px solid #c7d2fe", borderRadius: 8,
    display: "flex", alignItems: "center", gap: 5,
    cursor: "pointer", fontWeight: 700,
  },
  mobileCard: {
    background: "white", borderRadius: 16,
    border: "1.5px solid #e0e7ff", padding: "16px",
    boxShadow: "0 4px 16px rgba(79,70,229,0.07)",
  },
};
