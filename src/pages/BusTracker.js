import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const BUS_CONFIG = {
  bus1: { label: "Bus 1", color: "#6366f1", emoji: "🚌" },
  bus2: { label: "Bus 2", color: "#f59e0b", emoji: "🚍" },
};

export default function BusTracker() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;

  return role === "driver" ? <DriverPanel userProfile={userProfile} /> : <ViewerMap />;
}

/* ═══════════════════════════════════════════════════════
   DRIVER PANEL — only for role === "driver"
═══════════════════════════════════════════════════════ */
function DriverPanel({ userProfile }) {
  const [selectedBus, setSelectedBus] = useState("bus1");
  const [sharing, setSharing]         = useState(false);
  const watchIdRef  = useRef(null);
  const wakeLockRef = useRef(null);
  const sharingRef  = useRef(false);
  const selectedRef = useRef("bus1");

  useEffect(() => { selectedRef.current = selectedBus; }, [selectedBus]);

  async function startSharing() {
    if (!navigator.geolocation) {
      toast.error("GPS not available on this device");
      return;
    }
    try {
      if (navigator.wakeLock) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch { /* wake lock is optional */ }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async pos => {
        try {
          await setDoc(doc(db, "buses", selectedRef.current), {
            lat:        pos.coords.latitude,
            lng:        pos.coords.longitude,
            active:     true,
            updatedAt:  serverTimestamp(),
            driverName: userProfile?.name || "Driver",
          });
        } catch { /* silent */ }
      },
      err => { toast.error("GPS error: " + err.message); stopSharing(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    sharingRef.current = true;
    setSharing(true);
    toast.success(`📍 ${BUS_CONFIG[selectedBus].label} location is now live`);
  }

  async function stopSharing() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    try { await wakeLockRef.current?.release(); } catch { /* ok */ }
    wakeLockRef.current = null;
    try {
      await setDoc(
        doc(db, "buses", selectedRef.current),
        { active: false, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch { /* silent */ }
    sharingRef.current = false;
    setSharing(false);
    toast.success("Location sharing stopped");
  }

  useEffect(() => () => { if (sharingRef.current) stopSharing(); }, []); // eslint-disable-line

  const cfg = BUS_CONFIG[selectedBus];

  return (
    <div style={{
      minHeight: "70vh", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 28,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🚌</div>
        <h1 style={{
          fontFamily: "'Fredoka One', cursive", fontSize: 28,
          color: "#1e1b4b", margin: 0,
        }}>Driver Portal</h1>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "6px 0 0" }}>
          Welcome, {userProfile?.name || "Driver"}
        </p>
      </div>

      {/* Bus selector */}
      {!sharing && (
        <div style={{ display: "flex", gap: 14 }}>
          {Object.entries(BUS_CONFIG).map(([busId, c]) => (
            <button
              key={busId}
              onClick={() => setSelectedBus(busId)}
              style={{
                padding: "14px 32px", borderRadius: 16,
                border: `3px solid ${selectedBus === busId ? c.color : "#e0e7ff"}`,
                background: selectedBus === busId ? c.color : "white",
                color: selectedBus === busId ? "white" : "#6b7280",
                fontWeight: 800, fontSize: 18, cursor: "pointer",
                fontFamily: "'Fredoka One', cursive",
                transition: "all 0.15s",
                boxShadow: selectedBus === busId ? `0 6px 20px ${c.color}50` : "none",
              }}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Start / Stop button */}
      {!sharing ? (
        <button
          onClick={startSharing}
          style={{
            padding: "18px 52px", borderRadius: 50, border: "none",
            background: "linear-gradient(135deg, #16a34a, #22c55e)",
            color: "white", fontWeight: 800, fontSize: 20,
            cursor: "pointer", fontFamily: "'Fredoka One', cursive",
            boxShadow: "0 6px 24px rgba(22,163,74,0.4)",
            transition: "transform 0.1s",
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          📍 Start Location
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          {/* Live indicator */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "#f0fdf4", border: "2px solid #86efac",
            borderRadius: 16, padding: "16px 28px",
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: "50%",
              background: "#22c55e", boxShadow: "0 0 10px #22c55e",
              animation: "pulse 1.5s infinite",
            }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#166534", fontFamily: "'Nunito', sans-serif" }}>
                {cfg.emoji} {cfg.label} · Live
              </div>
              <div style={{ fontSize: 12, color: "#4ade80", marginTop: 2 }}>
                Screen stays on · GPS active
              </div>
            </div>
          </div>

          <button
            onClick={stopSharing}
            style={{
              padding: "16px 48px", borderRadius: 50, border: "none",
              background: "linear-gradient(135deg, #dc2626, #ef4444)",
              color: "white", fontWeight: 800, fontSize: 18,
              cursor: "pointer", fontFamily: "'Fredoka One', cursive",
              boxShadow: "0 6px 24px rgba(220,38,38,0.35)",
            }}
          >
            ⏹ Stop Location
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   VIEWER MAP — for admin, teacher, student
═══════════════════════════════════════════════════════ */
function ViewerMap() {
  const mapContainerRef = useRef(null);
  const leafletMapRef   = useRef(null);
  const markersRef      = useRef({});
  const [leafletReady, setLeafletReady] = useState(false);
  const [buses, setBuses] = useState({ bus1: null, bus2: null });

  // Load Leaflet from CDN
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (window.L) { setLeafletReady(true); return; }
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || leafletMapRef.current) return;
    const L   = window.L;
    const map = L.map(mapContainerRef.current).setView([11.0168, 76.9558], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19,
    }).addTo(map);
    leafletMapRef.current = map;
  }, [leafletReady]);

  // Firestore real-time listeners
  useEffect(() => {
    const unsubs = Object.keys(BUS_CONFIG).map(busId =>
      onSnapshot(doc(db, "buses", busId), snap => {
        setBuses(prev => ({ ...prev, [busId]: snap.exists() ? snap.data() : null }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, []);

  // Update markers
  useEffect(() => {
    if (!leafletMapRef.current || !window.L) return;
    const L   = window.L;
    const map = leafletMapRef.current;

    Object.entries(buses).forEach(([busId, data]) => {
      if (!data?.lat || !data?.lng || !data?.active) {
        if (markersRef.current[busId]) {
          map.removeLayer(markersRef.current[busId]);
          delete markersRef.current[busId];
        }
        return;
      }
      const cfg  = BUS_CONFIG[busId];
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${cfg.color};border:3px solid white;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 3px 12px rgba(0,0,0,0.4);">${cfg.emoji}</div>`,
        iconSize: [42, 42], iconAnchor: [21, 21],
      });
      if (markersRef.current[busId]) {
        markersRef.current[busId].setLatLng([data.lat, data.lng]);
      } else {
        markersRef.current[busId] = L.marker([data.lat, data.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${cfg.emoji} ${cfg.label}</b><br>Live`);
      }
    });

    const active = Object.values(buses).filter(b => b?.lat && b?.lng && b?.active);
    if (active.length === 1) map.setView([active[0].lat, active[0].lng], 15);
    else if (active.length === 2) {
      map.fitBounds(L.latLngBounds(active.map(b => [b.lat, b.lng])), { padding: [50, 50] });
    }
  }, [buses]);

  return (
    <div>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 55%, #2563eb 100%)",
        borderRadius: 24, padding: "20px 26px", marginBottom: 20,
        boxShadow: "0 8px 32px rgba(37,99,235,0.3)",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white", fontFamily: "'Fredoka One', cursive", fontWeight: 400, fontSize: 26, margin: 0 }}>
            🚌 Live Bus Tracker
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, margin: "4px 0 0" }}>
            Track school buses in real time
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(BUS_CONFIG).map(([busId, cfg]) => {
            const active = buses[busId]?.active;
            return (
              <div key={busId} style={{
                background: active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                border: `2px solid ${active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 50, padding: "6px 16px",
                color: "white", fontSize: 13, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: active ? "#4ade80" : "#f87171",
                  boxShadow: active ? "0 0 6px #4ade80" : "none",
                }} />
                {cfg.emoji} {cfg.label} · {active ? "Live" : "Offline"}
              </div>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div style={{
        borderRadius: 20, overflow: "hidden",
        border: "2px solid #e0e7ff",
        boxShadow: "0 8px 32px rgba(99,102,241,0.12)",
        height: 460, position: "relative",
      }}>
        {!leafletReady && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "#f8faff", gap: 12,
          }}>
            <div className="spinner" />
            <span style={{ color: "#6b7280", fontSize: 14 }}>Loading map…</span>
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Bus info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
        {Object.entries(BUS_CONFIG).map(([busId, cfg]) => {
          const data   = buses[busId];
          const active = data?.active;
          const updated = data?.updatedAt?.seconds
            ? new Date(data.updatedAt.seconds * 1000).toLocaleTimeString()
            : null;
          return (
            <div key={busId} style={{
              background: "white", borderRadius: 16, padding: "16px 18px",
              border: `2px solid ${active ? cfg.color + "50" : "#f3f4f6"}`,
              boxShadow: active ? `0 4px 16px ${cfg.color}18` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 30 }}>{cfg.emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 17, color: "#1e1b4b" }}>
                    {cfg.label}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: active ? "#16a34a" : "#9ca3af",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#22c55e" : "#d1d5db" }} />
                    {active ? "On Route" : "Not Running"}
                  </div>
                </div>
              </div>
              {active && data?.driverName && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>👤 {data.driverName}</div>
              )}
              {updated && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>🕐 Updated: {updated}</div>
              )}
              {!active && (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Bus is not currently running</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
