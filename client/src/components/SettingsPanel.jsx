import { useState, useCallback } from "react";
import { useKeyCapture } from "../hooks/useKeyBind.js";

const inputStyle = {
  background: "#060e06",
  border: "1px solid #1a2e1a",
  borderRadius: 4,
  color: "#86efac",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
  padding: "7px 10px",
  outline: "none",
  width: "100%",
};

const labelStyle = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  color: "#4ade80",
  letterSpacing: 1,
  opacity: 0.7,
  display: "block",
  marginBottom: 5,
};

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function SettingsPanel({ settings, onChange, devices, onClose }) {
  const [capturingKey, setCapturingKey] = useState(false);

  const { start: startCapture } = useKeyCapture(useCallback((code) => {
    setCapturingKey(false);
    onChange({ ...settings, pttKey: code });
  }, [settings, onChange]));

  const handleCaptureKey = () => {
    setCapturingKey(true);
    startCapture();
  };

  const set = (key) => (e) => {
    const val = e.target.type === "range"
      ? parseFloat(e.target.value)
      : e.target.type === "number"
        ? parseInt(e.target.value, 10)
        : e.target.value;
    onChange({ ...settings, [key]: val });
  };

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "rgba(2,9,2,0.95)",
      backdropFilter: "blur(10px)",
      borderRadius: 14,
      padding: 22,
      zIndex: 20,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#86efac", letterSpacing: 3 }}>
          CONFIGURATION
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.12)",
            color: "#8a9e8a", cursor: "pointer", borderRadius: 4,
            padding: "4px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
          }}
        >
          ESC / CLOSE
        </button>
      </div>

      {/* Network */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.4, letterSpacing: 2, marginBottom: 10 }}>
          ── NETWORK ──────────────────────────────
        </div>
        <Field label="SIGNALING SERVER">
          <input
            type="text"
            style={inputStyle}
            value={settings.signalingUrl || ""}
            onChange={set("signalingUrl")}
            placeholder="wss://signal.your-domain.com"
            spellCheck={false}
          />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#1a3a1a", marginTop: 4 }}>
            Leave blank to use demo mode (local PTT only)
          </div>
        </Field>
        <Field label="ROOM / CHANNEL NAME">
          <input
            type="text"
            style={inputStyle}
            value={settings.room || ""}
            onChange={set("room")}
            placeholder="alpha-team"
            spellCheck={false}
          />
        </Field>
      </div>

      {/* Audio */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.4, letterSpacing: 2, marginBottom: 10 }}>
          ── AUDIO ────────────────────────────────
        </div>
        <Field label="INPUT DEVICE">
          <select style={inputStyle} value={settings.inputDevice || ""} onChange={set("inputDevice")}>
            <option value="">Default Microphone</option>
            {(devices.inputs || []).map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`INPUT GAIN: ${Math.round(settings.inputGain * 100)}%`}>
          <input type="range" min="0" max="3" step="0.05" value={settings.inputGain} onChange={set("inputGain")} style={{ accentColor: "#22c55e" }} />
        </Field>
        <Field label={`OUTPUT GAIN: ${Math.round(settings.outputGain * 100)}%`}>
          <input type="range" min="0" max="2" step="0.05" value={settings.outputGain} onChange={set("outputGain")} style={{ accentColor: "#22c55e" }} />
        </Field>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.4, letterSpacing: 2, marginBottom: 10 }}>
          ── CONTROLS ─────────────────────────────
        </div>
        <Field label="PTT HOTKEY">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              style={{ ...inputStyle, flex: 1 }}
              value={capturingKey ? "PRESS ANY KEY..." : settings.pttKey || "Space"}
              readOnly
            />
            <button
              onClick={handleCaptureKey}
              style={{
                background: capturingKey ? "#0a2a0a" : "#060e06",
                border: `1px solid ${capturingKey ? "#22c55e" : "#1a2e1a"}`,
                color: capturingKey ? "#22c55e" : "#4ade80",
                cursor: "pointer", borderRadius: 4,
                padding: "7px 12px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                whiteSpace: "nowrap",
              }}
            >
              {capturingKey ? "LISTENING..." : "REBIND"}
            </button>
          </div>
        </Field>
        <Field label={`CHANNEL: ${settings.channel || 1}`}>
          <input type="range" min="1" max="99" step="1" value={settings.channel || 1} onChange={set("channel")} style={{ accentColor: "#22c55e" }} />
        </Field>
      </div>

      <button
        onClick={onClose}
        style={{
          marginTop: "auto",
          paddingTop: 16,
          background: "#0a1a0a", border: "1px solid #22c55e",
          color: "#22c55e", cursor: "pointer", borderRadius: 6,
          padding: "10px", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, letterSpacing: 1,
        }}
      >
        SAVE &amp; CLOSE
      </button>
    </div>
  );
}
