/**
 * PTT-Radio Signaling Server
 *
 * Lightweight WebSocket relay for WebRTC SDP / ICE negotiation.
 * No audio passes through this server — it only brokers peer discovery
 * and relays signaling messages. All audio travels peer-to-peer via SRTP.
 *
 * Protocol messages (JSON):
 *   Client → Server:
 *     { type: "join",   room: string, peer: string }
 *     { type: "offer",  from, to, data: RTCSessionDescription }
 *     { type: "answer", from, to, data: RTCSessionDescription }
 *     { type: "ice",    from, to, data: RTCIceCandidate }
 *     { type: "ping" }
 *
 *   Server → Client:
 *     { type: "peer-list",   data: string[] }   — on join, list of existing peers
 *     { type: "peer-joined", from: string }      — when another peer joins
 *     { type: "peer-left",   from: string }      — when a peer disconnects
 *     { type: "offer" | "answer" | "ice", ... }  — forwarded verbatim
 *     { type: "pong" }
 *     { type: "error", message: string }
 */

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

// ── Config ────────────────────────────────────────────────────────────────────
const PORT            = parseInt(process.env.PORT          ?? "3001", 10);
const MAX_ROOMS       = parseInt(process.env.MAX_ROOMS     ?? "500",  10);
const MAX_PEERS_ROOM  = parseInt(process.env.MAX_PEERS     ?? "8",    10);
const HEARTBEAT_MS    = parseInt(process.env.HEARTBEAT_MS  ?? "20000", 10);
const MSG_MAX_BYTES   = parseInt(process.env.MSG_MAX_BYTES ?? "65536", 10); // 64 KB

// ── Room registry ─────────────────────────────────────────────────────────────
// rooms: Map<roomId, Map<peerId, WebSocket>>
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    if (rooms.size >= MAX_ROOMS) return null; // cap rooms
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function cleanRoom(roomId) {
  const room = rooms.get(roomId);
  if (room && room.size === 0) rooms.delete(roomId);
}

function broadcast(room, msg, excludePeerId = null) {
  const raw = JSON.stringify(msg);
  for (const [peerId, ws] of room.entries()) {
    if (peerId === excludePeerId) continue;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── HTTP server (health check endpoint) ──────────────────────────────────────
const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const stats = {
      status:     "ok",
      rooms:      rooms.size,
      peers:      [...rooms.values()].reduce((n, r) => n + r.size, 0),
      uptime:     Math.round(process.uptime()),
      memoryMB:   Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp:  new Date().toISOString(),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MSG_MAX_BYTES,
  // Allow cross-origin connections — tighten this in production
  verifyClient: ({ origin }, cb) => {
    const allowed = process.env.ALLOWED_ORIGINS;
    if (!allowed) return cb(true); // open by default
    const origins = allowed.split(",").map((o) => o.trim());
    cb(origins.includes(origin));
  },
});

wss.on("connection", (ws, req) => {
  // Metadata stored on the socket object
  ws._peerId = null;
  ws._roomId = null;
  ws._alive  = true;

  const clientIp = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress;
  console.log(`[signal] connect  ip=${clientIp}`);

  // ── Message handler ─────────────────────────────────────────────────────
  ws.on("message", (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    const { type, room, peer, from, to, data } = msg;

    // ── ping / pong ─────────────────────────────────────────────────────
    if (type === "ping") {
      ws._alive = true;
      send(ws, { type: "pong" });
      return;
    }

    // ── join ─────────────────────────────────────────────────────────────
    if (type === "join") {
      if (!room || !peer || typeof room !== "string" || typeof peer !== "string") {
        send(ws, { type: "error", message: "join requires room and peer" });
        return;
      }
      if (peer.length > 64 || room.length > 64) {
        send(ws, { type: "error", message: "room/peer id too long" });
        return;
      }

      const roomMap = getOrCreateRoom(room);
      if (!roomMap) {
        send(ws, { type: "error", message: "Server room limit reached" });
        return;
      }
      if (roomMap.size >= MAX_PEERS_ROOM) {
        send(ws, { type: "error", message: "Room is full" });
        return;
      }

      // Evict stale connection with the same peer id
      if (roomMap.has(peer)) {
        const old = roomMap.get(peer);
        if (old.readyState === WebSocket.OPEN) old.close(1000, "Replaced");
        roomMap.delete(peer);
      }

      ws._peerId = peer;
      ws._roomId = room;
      roomMap.set(peer, ws);

      // Send existing peer list to newcomer
      const existingPeers = [...roomMap.keys()].filter((id) => id !== peer);
      send(ws, { type: "peer-list", data: existingPeers });

      // Notify existing peers
      broadcast(roomMap, { type: "peer-joined", from: peer }, peer);

      console.log(`[signal] join     room=${room} peer=${peer} size=${roomMap.size}`);
      return;
    }

    // All messages below require the peer to be in a room
    if (!ws._peerId || !ws._roomId) {
      send(ws, { type: "error", message: "Not in a room — send join first" });
      return;
    }

    // ── offer / answer / ice ─────────────────────────────────────────────
    if (type === "offer" || type === "answer" || type === "ice") {
      if (!to || !data) {
        send(ws, { type: "error", message: `${type} requires to and data` });
        return;
      }
      const roomMap = rooms.get(ws._roomId);
      if (!roomMap) return;

      const target = roomMap.get(to);
      if (target && target.readyState === WebSocket.OPEN) {
        send(target, { type, from: ws._peerId, to, data });
      }
      return;
    }

    send(ws, { type: "error", message: `Unknown message type: ${type}` });
  });

  // ── Close handler ───────────────────────────────────────────────────────
  ws.on("close", () => {
    if (!ws._peerId || !ws._roomId) return;
    const roomMap = rooms.get(ws._roomId);
    if (!roomMap) return;

    roomMap.delete(ws._peerId);
    broadcast(roomMap, { type: "peer-left", from: ws._peerId });
    cleanRoom(ws._roomId);

    console.log(`[signal] leave    room=${ws._roomId} peer=${ws._peerId}`);
  });

  ws.on("error", (err) => {
    console.error(`[signal] socket error peer=${ws._peerId ?? "unknown"}:`, err.message);
  });
});

// ── Heartbeat — detect zombie connections ─────────────────────────────────────
const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws._alive) {
      ws.terminate();
      continue;
    }
    ws._alive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeatInterval));

// Handle pong frames from clients
wss.on("connection", (ws) => {
  ws.on("pong", () => { ws._alive = true; });
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[signal] PTT-Radio signaling server listening on port ${PORT}`);
  console.log(`[signal] Health:   http://localhost:${PORT}/health`);
  console.log(`[signal] WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[signal] SIGTERM — shutting down...");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[signal] SIGINT — shutting down...");
  httpServer.close(() => process.exit(0));
});
