// ─── LCDDisplay ──────────────────────────────────────────────────────────────
const STATE_LABELS = {
  idle:         "STANDBY",
  connecting:   "CONN...",
  connected:    "ONLINE",
  demo:         "LOCAL",
  disconnected: "OFFLINE",
  transmitting: "TX ACTIVE",
};

export function LCDDisplay({ channel, room, state, peerCount, txDuration }) {
  return (
    <div style={{
      background: "#060e06",
      border: "1px solid #1a3a1a",
      borderRadius: 5,
      padding: "9px 12px",
      fontFamily: "'IBM Plex Mono', monospace",
      lineHeight: 1.6,
      color: "#4ade80",
      textShadow: "0 0 8px rgba(74,222,128,0.25)",
      flex: 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#86efac", fontSize: 14, fontWeight: 600, letterSpacing: 2 }}>
          CH {String(channel).padStart(3, "0")}
        </span>
        <span style={{ fontSize: 11, color: "#4ade80", opacity: 0.7 }}>
          {STATE_LABELS[state] ?? state.toUpperCase()}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6, fontSize: 10 }}>
        <span>{room ? room.toUpperCase().slice(0, 12) : "NO ROOM"}</span>
        <span>{peerCount} PEER{peerCount !== 1 ? "S" : ""}</span>
      </div>
      {txDuration > 0 && (
        <div style={{ marginTop: 4, color: "#fbbf24", fontSize: 9 }}>
          LAST TX: {(txDuration / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}

// ─── SignalBars ───────────────────────────────────────────────────────────────
export function SignalBars({ strength = 0 }) {
  return (
    <div
      style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}
      aria-label={`Signal strength: ${strength} of 5`}
    >
      {[1, 2, 3, 4, 5].map((b) => (
        <div key={b} style={{
          width: 3,
          height: 4 + b * 2,
          background: b <= strength ? "#22c55e" : "#1a2e1a",
          borderRadius: 1,
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

// ─── PeerBadge ────────────────────────────────────────────────────────────────
export function PeerBadge({ peer, isTransmitting }) {
  const connected = peer.state === "connected";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 9px",
      background: isTransmitting ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isTransmitting ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.05)"}`,
      borderRadius: 5,
      transition: "all 0.2s",
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: connected ? "#22c55e" : peer.state === "connecting" ? "#f59e0b" : "#ef4444",
        boxShadow: connected ? "0 0 5px rgba(34,197,94,0.5)" : "none",
        transition: "background 0.3s",
      }} />
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11, color: "#8a9e8a", flex: 1,
      }}>
        {peer.id}
      </span>
      {isTransmitting && (
        <span style={{
          fontSize: 9, color: "#22c55e",
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: 1,
          animation: "tx-flash 0.5s ease infinite",
        }}>
          TX
        </span>
      )}
      <span style={{
        fontSize: 9,
        fontFamily: "'IBM Plex Mono', monospace",
        color: "#1a2e1a",
        letterSpacing: 1,
      }}>
        {peer.state.toUpperCase()}
      </span>
    </div>
  );
}

// ─── SquelchIndicator ─────────────────────────────────────────────────────────
export function SquelchIndicator({ active }) {
  return (
    <div style={{
      display: "flex", gap: 2, alignItems: "center",
      opacity: active ? 1 : 0.15,
      transition: "opacity 0.25s",
    }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{
          width: 2,
          height: active ? `${5 + Math.sin(i * 1.1) * 4 + 4}px` : "4px",
          background: "#22c55e",
          borderRadius: 1,
          transition: "height 0.08s",
          transitionDelay: active ? `${i * 0.025}s` : "0s",
        }} />
      ))}
    </div>
  );
}
