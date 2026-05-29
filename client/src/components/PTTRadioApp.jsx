import { useState, useCallback } from "react";
import { usePTTEngine } from "../hooks/usePTTEngine.js";
import { useKeyBind } from "../hooks/useKeyBind.js";
import { VUMeter } from "./VUMeter.jsx";
import { WaveformRing } from "./WaveformRing.jsx";
import { PTTButton } from "./PTTButton.jsx";
import { SettingsPanel } from "./SettingsPanel.jsx";
import { EventLog } from "./EventLog.jsx";
import {
  LCDDisplay,
  SignalBars,
  PeerBadge,
  SquelchIndicator,
} from "./DisplayComponents.jsx";

// ─── Global keyframe animations injected once ─────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Rajdhani:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root {
    min-height: 100vh;
    background: linear-gradient(160deg, #020902 0%, #060e06 100%);
    -webkit-font-smoothing: antialiased;
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0   rgba(34,197,94,0.4); }
    70%  { box-shadow: 0 0 0 18px rgba(34,197,94,0); }
    100% { box-shadow: 0 0 0 0   rgba(34,197,94,0); }
  }
  @keyframes tx-flash {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.55; }
  }
  button:focus-visible { outline: 2px solid rgba(34,197,94,0.5); outline-offset: 2px; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1a2e1a; border-radius: 2px; }
`;

// ─── Main component ───────────────────────────────────────────────────────────
export default function PTTRadioApp() {
  const {
    appState, sigState, transmitting, levelDb,
    peers, lastTxDuration, devices, eventLog,
    settings, setSettings, analyserRef,
    initAudio, connectToRoom, disconnectFromRoom,
    startTransmit, stopTransmit, peerId,
  } = usePTTEngine();

  const [showSettings, setShowSettings] = useState(false);
  const [pttHeld, setPttHeld] = useState(false);

  // ── PTT handlers
  const handlePttDown = useCallback(() => {
    if (appState === "connected" && !pttHeld) {
      setPttHeld(true);
      startTransmit();
    }
  }, [appState, pttHeld, startTransmit]);

  const handlePttUp = useCallback(() => {
    if (pttHeld) {
      setPttHeld(false);
      stopTransmit();
    }
  }, [pttHeld, stopTransmit]);

  // Keyboard PTT binding
  useKeyBind(settings.pttKey || "Space", handlePttDown, handlePttUp, appState === "connected");

  // ── Connect / disconnect
  const handleConnect = async () => {
    if (appState === "connected") {
      disconnectFromRoom();
    } else if (appState === "ready") {
      await connectToRoom(settings.signalingUrl, settings.room);
    }
  };

  // ── Derived display values
  const signalStrength =
    sigState === "connected" ? 5 :
    sigState === "demo"      ? 4 :
    sigState === "connecting"? 2 : 0;

  const displayState = transmitting ? "transmitting" : sigState;

  const isConnected = appState === "connected";
  const isReady     = appState === "ready" || isConnected;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        fontFamily: "'Rajdhani', sans-serif",
      }}>
        {/* ── Radio body ─────────────────────────────────────────────────── */}
        <main
          aria-label="PTT-Radio"
          style={{
            width: "100%",
            maxWidth: 500,
            background: "#090e09",
            border: "1px solid #1a2e1a",
            borderRadius: 14,
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 0 80px rgba(34,197,94,0.03), 0 32px 64px rgba(0,0,0,0.8)",
          }}
        >
          {/* CRT scanline overlay */}
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, borderRadius: 14,
            background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.055) 2px,rgba(0,0,0,0.055) 4px)",
          }} />

          {/* Settings panel (overlay) */}
          {showSettings && (
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              devices={devices}
              onClose={() => setShowSettings(false)}
            />
          )}

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <header style={{
            background: "#050c05",
            borderBottom: "1px solid #132013",
            padding: "11px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 2,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Radio icon */}
              <div style={{
                width: 30, height: 30, background: "#060e06",
                border: "1px solid #1a2e1a", borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M3 7h12v8H3V7z" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6.5" cy="11" r="1.5" stroke="#22c55e" strokeWidth="1"/>
                  <path d="M10 9.5h3M10 11h3M10 12.5h2" stroke="#22c55e" strokeWidth="1" strokeLinecap="round"/>
                  <path d="M6 5l2-2M9 4.5V2M12 5l-2-2" stroke="#22c55e" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#86efac", fontWeight: 600, letterSpacing: 3 }}>
                  PTT-RADIO
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.4, letterSpacing: 1 }}>
                  v1.0.0 · {peerId}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SignalBars strength={signalStrength} />
              {/* Status indicator */}
              <div
                aria-label={transmitting ? "Transmitting" : sigState}
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: transmitting ? "#ef4444" : isConnected ? "#22c55e" : "#1a2e1a",
                  boxShadow: transmitting
                    ? "0 0 8px rgba(239,68,68,0.6)"
                    : isConnected ? "0 0 6px rgba(34,197,94,0.4)" : "none",
                  animation: transmitting ? "tx-flash 0.5s ease infinite" : "none",
                  transition: "background 0.3s",
                }}
              />
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Open settings"
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#4ade80", cursor: "pointer", borderRadius: 4,
                  padding: "3px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                }}
              >
                CFG
              </button>
            </div>
          </header>

          {/* ── Body ─────────────────────────────────────────────────────────── */}
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 2 }}>

            {/* LCD + waveform row */}
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <LCDDisplay
                channel={settings.channel || 1}
                room={settings.room}
                state={displayState}
                peerCount={peers.length}
                txDuration={lastTxDuration}
              />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <WaveformRing analyserRef={analyserRef} transmitting={transmitting} size={82} />
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.35 }}>
                  {levelDb > -120 ? `${Math.round(levelDb)} dBFS` : "-- dBFS"}
                </div>
              </div>
            </div>

            {/* VU meter panel */}
            <div style={{ background: "#050c05", border: "1px solid #132013", borderRadius: 6, padding: "10px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.45, letterSpacing: 1 }}>
                  INPUT LEVEL
                </span>
                <SquelchIndicator active={transmitting} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.45, letterSpacing: 1 }}>
                  AUDIO
                </span>
              </div>
              <VUMeter db={levelDb} transmitting={transmitting} />
              <div style={{
                display: "flex", justifyContent: "space-between", marginTop: 4,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#1a2e1a",
              }}>
                {["-60", "-40", "-20", "-12", "-6", "0"].map((v) => <span key={v}>{v}</span>)}
              </div>
            </div>

            {/* Control buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => initAudio(settings.inputDevice)}
                disabled={isReady}
                style={{
                  flex: 1, borderRadius: 6, padding: "9px 8px",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1,
                  cursor: isReady ? "default" : "pointer",
                  background: isReady ? "#0a1a0a" : "#090e09",
                  border: `1px solid ${isReady ? "#22c55e" : "#1a2e1a"}`,
                  color: isReady ? "#22c55e" : "#4ade80",
                  opacity: isReady ? 1 : 0.9,
                  transition: "all 0.2s",
                }}
              >
                {appState === "initializing" ? "INIT..." : isReady ? "MIC READY ✓" : "INIT MIC"}
              </button>

              <button
                onClick={handleConnect}
                disabled={!isReady}
                style={{
                  flex: 1, borderRadius: 6, padding: "9px 8px",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1,
                  cursor: isReady ? "pointer" : "not-allowed",
                  background: isConnected ? "#0a1a07" : "#090e09",
                  border: `1px solid ${isConnected ? "#22c55e" : "#1a2e1a"}`,
                  color: isConnected ? "#22c55e" : "#4ade80",
                  opacity: isReady ? 1 : 0.35,
                  transition: "all 0.2s",
                }}
              >
                {isConnected ? "DISCONNECT" : sigState === "connecting" ? "CONN..." : "CONNECT"}
              </button>
            </div>

            {/* PTT button */}
            <PTTButton
              transmitting={transmitting}
              enabled={isConnected}
              pttKey={settings.pttKey}
              onDown={handlePttDown}
              onUp={handlePttUp}
            />

            {/* Peers panel */}
            <div style={{ background: "#050c05", border: "1px solid #132013", borderRadius: 6, padding: "10px 12px" }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#4ade80", opacity: 0.45, letterSpacing: 1,
              }}>
                <span>CONNECTED PEERS</span>
                <span>{peers.length}/8</span>
              </div>

              {peers.length === 0 ? (
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#1a2e1a",
                  textAlign: "center", padding: "7px 0",
                }}>
                  {isConnected ? "WAITING FOR PEERS..." : "NOT CONNECTED"}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {peers.map((peer) => (
                    <PeerBadge key={peer.id} peer={peer} isTransmitting={false} />
                  ))}
                </div>
              )}
            </div>

            {/* Event log */}
            <EventLog entries={eventLog} />

            {/* Footer */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderTop: "1px solid #0c140c", paddingTop: 11,
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#1a2e1a", letterSpacing: 1 }}>
                WebRTC · Opus · SRTP
              </span>
              <div style={{ display: "flex", gap: 5 }}>
                {[["OPUS", "CODEC"], ["48kHz", "RATE"], ["20ms", "FRAME"]].map(([val, lbl]) => (
                  <div key={lbl} style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                    color: "#1a2e1a", padding: "2px 6px",
                    border: "1px solid #0c140c", borderRadius: 3,
                  }}>
                    {val}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
