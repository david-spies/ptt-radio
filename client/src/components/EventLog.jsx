// EventLog — scrollable terminal-style event log

export function EventLog({ entries }) {
  return (
    <div
      role="log"
      aria-label="System event log"
      style={{
        background: "#030803",
        border: "1px solid #0c140c",
        borderRadius: 6,
        padding: "8px 10px",
        maxHeight: 90,
        overflowY: "auto",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        lineHeight: 1.65,
      }}
    >
      {entries.length === 0 ? (
        <span style={{ color: "#1a3a1a" }}>▶ PTT-RADIO READY</span>
      ) : (
        entries.slice(0, 10).map((entry, i) => (
          <div key={i} style={{ color: i === 0 ? "#4ade80" : "#1e3a1e" }}>
            <span style={{ opacity: 0.5 }}>{entry.time} </span>
            <span>{entry.type.toUpperCase()}</span>
            {entry.payload && Object.keys(entry.payload).length > 0 && (
              <span style={{ opacity: 0.45 }}>
                {" "}
                {Object.entries(entry.payload)
                  .map(([k, v]) => `${k}:${typeof v === "object" ? JSON.stringify(v) : v}`)
                  .join(" ")}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
