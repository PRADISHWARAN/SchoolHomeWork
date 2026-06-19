import React, { useState, useEffect, useRef } from "react";
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
  setDoc, getDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, Calendar, X, Upload, FileText, Download, Eye } from "lucide-react";
import toast from "react-hot-toast";

const EVENT_TYPES = [
  { value: "holiday", label: "Holiday",      emoji: "🏖️", color: "#fef3c7", text: "#92400e" },
  { value: "exam",    label: "Exam",         emoji: "📝", color: "#dbeafe", text: "#1e40af" },
  { value: "event",   label: "School Event", emoji: "🎉", color: "#d1fae5", text: "#065f46" },
  { value: "meeting", label: "Meeting",      emoji: "👥", color: "#ede9fe", text: "#4c1d95" },
  { value: "sports",  label: "Sports",       emoji: "⚽", color: "#ffedd5", text: "#9a3412" },
];

function getType(value) {
  return EVENT_TYPES.find(t => t.value === value) || EVENT_TYPES[2];
}

const EMPTY_FORM = { title: "", date: "", endDate: "", type: "event", description: "" };

export default function AcademicCalendar() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const [calendarPdf, setCalendarPdf] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchEvents(); fetchCalendarPdf(); }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "academicCalendar"), orderBy("date")));
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error("Failed to load calendar");
    }
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title || !form.date) return toast.error("Title and date are required");
    setSubmitting(true);
    try {
      await addDoc(collection(db, "academicCalendar"), {
        ...form,
        postedBy: userProfile.name,
        postedAt: serverTimestamp(),
      });
      toast.success("Event added!");
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      fetchEvents();
    } catch {
      toast.error("Failed to add event");
    }
    setSubmitting(false);
  }

  async function fetchCalendarPdf() {
    try {
      const snap = await getDoc(doc(db, "settings", "calendarPdf"));
      if (snap.exists()) setCalendarPdf(snap.data());
    } catch { /* no pdf yet */ }
  }

  async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Please select a PDF file");
    if (file.size > 20 * 1024 * 1024) return toast.error("File must be under 20 MB");

    const storageRef = ref(storage, "calendar/academic-calendar.pdf");
    const task = uploadBytesResumable(storageRef, file);

    task.on("state_changed",
      snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => { toast.error("Upload failed"); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const data = {
          url,
          fileName: file.name,
          uploadedBy: userProfile.name,
          uploadedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "settings", "calendarPdf"), data);
        setCalendarPdf(data);
        setUploadProgress(null);
        toast.success("Calendar PDF uploaded!");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    );
  }

  async function handleRemovePdf() {
    if (!window.confirm("Remove the uploaded calendar PDF?")) return;
    try {
      await deleteObject(ref(storage, "calendar/academic-calendar.pdf"));
      await deleteDoc(doc(db, "settings", "calendarPdf"));
      setCalendarPdf(null);
      toast.success("PDF removed");
    } catch { toast.error("Failed to remove PDF"); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this event?")) return;
    try {
      await deleteDoc(doc(db, "academicCalendar", id));
      toast.success("Deleted");
      fetchEvents();
    } catch { toast.error("Failed"); }
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter(e => e.date >= today);
  const past = events.filter(e => e.date < today);

  if (loading) return <div className="loader"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📆 Academic Calendar</h1>
          <p>{events.length} events · {upcoming.length} upcoming</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {role === "admin" && (
            <>
              <label style={{ ...styles.addBtn, background: "#059669", cursor: "pointer" }}>
                <Upload size={17} style={{ marginRight: 6 }} />
                {uploadProgress !== null ? `Uploading ${uploadProgress}%` : calendarPdf ? "Replace PDF" : "Upload PDF"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={handlePdfUpload}
                  disabled={uploadProgress !== null}
                />
              </label>
              <button style={styles.addBtn} onClick={() => setShowModal(true)}>
                <Plus size={17} style={{ marginRight: 6 }} /> Add Event
              </button>
            </>
          )}
        </div>
      </div>

      {/* Annual Calendar PDF banner */}
      {calendarPdf && (
        <div style={styles.pdfBanner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={styles.pdfIcon}><FileText size={28} color="#4f46e5" /></div>
            <div>
              <div style={styles.pdfBannerTitle}>Annual Academic Calendar PDF</div>
              <div style={styles.pdfBannerSub}>{calendarPdf.fileName} · Uploaded by {calendarPdf.uploadedBy}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.pdfActionBtn} onClick={() => setShowPdfViewer(true)}>
              <Eye size={15} style={{ marginRight: 5 }} /> View
            </button>
            <a href={calendarPdf.url} download target="_blank" rel="noreferrer" style={{ ...styles.pdfActionBtn, textDecoration: "none" }}>
              <Download size={15} style={{ marginRight: 5 }} /> Download
            </a>
            {role === "admin" && (
              <button style={{ ...styles.pdfActionBtn, background: "#fee2e2", color: "#dc2626" }} onClick={handleRemovePdf}>
                <Trash2 size={15} style={{ marginRight: 5 }} /> Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Type legend */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {EVENT_TYPES.map(t => (
          <span key={t.value} style={{ ...styles.legendBadge, background: t.color, color: t.text }}>
            {t.emoji} {t.label}
          </span>
        ))}
      </div>

      <h2 style={styles.sectionTitle}>Upcoming Events</h2>
      {upcoming.length === 0 ? (
        <div className="card empty-state">
          <Calendar size={48} />
          <h3>No upcoming events</h3>
          {role === "admin" && <p>Click "Add Event" to post the first one.</p>}
        </div>
      ) : (
        upcoming.map(event => (
          <EventCard key={event.id} event={event} role={role} onDelete={handleDelete} />
        ))
      )}

      {past.length > 0 && (
        <>
          <h2 style={{ ...styles.sectionTitle, marginTop: 32 }}>Past Events</h2>
          {past.map(event => (
            <EventCard key={event.id} event={event} role={role} onDelete={handleDelete} past />
          ))}
        </>
      )}

      {showPdfViewer && calendarPdf && (
        <div style={styles.overlay} onClick={() => setShowPdfViewer(false)}>
          <div style={{ ...styles.modal, maxWidth: 860, height: "90vh", display: "flex", flexDirection: "column", padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ ...styles.modalHeader, padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={18} color="#4f46e5" />
                <h3 style={styles.modalTitle}>{calendarPdf.fileName}</h3>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a href={calendarPdf.url} download target="_blank" rel="noreferrer" style={{ ...styles.pdfActionBtn, textDecoration: "none" }}>
                  <Download size={15} style={{ marginRight: 5 }} /> Download
                </a>
                <button style={styles.closeBtn} onClick={() => setShowPdfViewer(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <iframe
              src={calendarPdf.url + "#toolbar=1"}
              title="Academic Calendar PDF"
              style={{ flex: 1, border: "none", borderRadius: "0 0 20px 20px" }}
            />
          </div>
        </div>
      )}

      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Calendar Event</h3>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Event Title *</label>
                <input
                  style={styles.input}
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Annual Sports Day"
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Start Date *</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>End Date (optional)</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Event Type</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EVENT_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, type: t.value }))}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: "2px solid",
                        borderColor: form.type === t.value ? t.text : "#e5e7eb",
                        background: form.type === t.value ? t.color : "white",
                        color: form.type === t.value ? t.text : "#6b7280",
                        fontWeight: 700,
                        fontSize: 13,
                        fontFamily: "'Poppins', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  style={{ ...styles.input, resize: "vertical", minHeight: 80 }}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Details about this event..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={submitting}>
                  {submitting ? "Adding..." : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, role, onDelete, past }) {
  const type = getType(event.type);
  const startDate = new Date(event.date + "T00:00:00");
  const endDate = event.endDate ? new Date(event.endDate + "T00:00:00") : null;

  return (
    <div style={{ ...styles.eventCard, opacity: past ? 0.65 : 1 }}>
      <div style={{ ...styles.dateBlock, background: type.color, color: type.text }}>
        <div style={styles.dateDay}>{startDate.getDate()}</div>
        <div style={styles.dateMonth}>
          {startDate.toLocaleString("default", { month: "short" }).toUpperCase()}
        </div>
        <div style={{ fontSize: 22, marginTop: 4 }}>{type.emoji}</div>
      </div>
      <div style={styles.eventInfo}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={styles.eventTitle}>{event.title}</div>
          <span style={{ ...styles.typeBadge, background: type.color, color: type.text }}>
            {type.label}
          </span>
          {past && <span style={styles.pastBadge}>Past</span>}
        </div>
        {event.description && <div style={styles.eventDesc}>{event.description}</div>}
        <div style={styles.eventMeta}>
          <span>
            📅 {startDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {endDate && ` → ${endDate.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}`}
          </span>
          <span>Posted by: {event.postedBy}</span>
        </div>
      </div>
      {role === "admin" && (
        <button style={styles.deleteBtn} onClick={() => onDelete(event.id)} title="Delete event">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

const styles = {
  addBtn: {
    display: "flex",
    alignItems: "center",
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
  legendBadge: {
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Poppins', sans-serif",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#374151",
    fontFamily: "'Nunito', sans-serif",
    marginBottom: 12,
    marginTop: 8,
  },
  eventCard: {
    display: "flex",
    alignItems: "stretch",
    background: "white",
    borderRadius: 14,
    marginBottom: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    overflow: "hidden",
    border: "1px solid #f0f0f0",
  },
  dateBlock: {
    minWidth: 72,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 10px",
    flexShrink: 0,
  },
  dateDay: {
    fontSize: 28,
    fontWeight: 900,
    fontFamily: "'Nunito', sans-serif",
    lineHeight: 1,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Poppins', sans-serif",
    letterSpacing: 1,
  },
  eventInfo: {
    flex: 1,
    padding: "14px 16px",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1f2937",
    fontFamily: "'Nunito', sans-serif",
  },
  typeBadge: {
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Poppins', sans-serif",
  },
  pastBadge: {
    padding: "2px 8px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: "#f3f4f6",
    color: "#9ca3af",
    fontFamily: "'Poppins', sans-serif",
  },
  eventDesc: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    fontFamily: "'Poppins', sans-serif",
  },
  eventMeta: {
    display: "flex",
    gap: 16,
    marginTop: 8,
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "'Poppins', sans-serif",
    flexWrap: "wrap",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    padding: "0 16px",
    flexShrink: 0,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: "white",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 540,
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#1f2937",
    fontFamily: "'Nunito', sans-serif",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#9ca3af",
    padding: 4,
    borderRadius: 8,
  },
  formGroup: { marginBottom: 16 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 6,
    fontFamily: "'Poppins', sans-serif",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    outline: "none",
    boxSizing: "border-box",
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
  submitBtn: {
    padding: "10px 24px",
    background: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    cursor: "pointer",
  },
  pdfBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
    border: "1.5px solid #c7d2fe",
    borderRadius: 14,
    padding: "14px 18px",
    marginBottom: 20,
  },
  pdfIcon: {
    width: 48,
    height: 48,
    background: "white",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(79,70,229,0.12)",
    flexShrink: 0,
  },
  pdfBannerTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#3730a3",
    fontFamily: "'Nunito', sans-serif",
  },
  pdfBannerSub: {
    fontSize: 12,
    color: "#6366f1",
    fontFamily: "'Poppins', sans-serif",
    marginTop: 2,
  },
  pdfActionBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 14px",
    background: "white",
    color: "#4f46e5",
    border: "1.5px solid #c7d2fe",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    fontFamily: "'Poppins', sans-serif",
    cursor: "pointer",
  },
};
