// PTTButton — the large circular push-to-talk trigger

export function PTTButton({ transmitting, enabled, pttKey, onDown, onUp }) {
  const micColor = transmitting ? "#22c55e" : enabled ? "#1a3a1a" : "#0f1f0f";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <button
        onMouseDown={onDown}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={(e) => { e.preventDefault(); onDown(); }}
        onTouchEnd={onUp}
        disabled={!enabled}
        aria-pressed={transmitting}
        aria-label={transmitting ? "Transmitting — release to stop" : "Push to talk — hold to transmit"}
        style={{
          width: 114,
          height: 114,
          borderRadius: "50%",
          background: transmitting
            ? "radial-gradient(circle, #0f2a07 0%, #0a1f06 70%)"
            : "radial-gradient(circle, #0a1a06 0%, #060e06 70%)",
          border: `3px solid ${transmitting ? "#22c55e" : enabled ? "#1a2e1a" : "#0d160d"}`,
          cursor: enabled ? "pointer" : "not-allowed",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          opacity: enabled ? 1 : 0.3,
          transition: "border-color 0.12s, background 0.12s, opacity 0.2s",
          animation: transmitting ? "pulse-ring 1s ease-out infinite" : "none",
          boxShadow: transmitting
            ? "0 0 28px rgba(34,197,94,0.18), inset 0 0 18px rgba(34,197,94,0.04)"
            : "inset 0 0 20px rgba(0,0,0,0.35)",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Microphone icon */}
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <rect x="10" y="4" width="8" height="14" rx="4" fill={micColor} />
          <path d="M6 16c0 4.418 3.582 8 8 8s8-3.582 8-8"
            stroke={micColor} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <line x1="14" y1="24" x2="14" y2="27" stroke={micColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="27" x2="18" y2="27" stroke={micColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          letterSpacing: 2,
          color: micColor,
          animation: transmitting ? "tx-flash 0.5s ease infinite" : "none",
        }}>
          {transmitting ? "TRANSMIT" : "PUSH"}
        </span>
      </button>

      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 9,
        color: enabled ? "#2a4a2a" : "#1a2e1a",
        letterSpacing: 1,
        textAlign: "center",
        transition: "color 0.2s",
      }}>
        HOLD {(pttKey || "SPACE").toUpperCase()} TO TALK
      </div>
    </div>
  );
}
