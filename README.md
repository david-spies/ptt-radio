# PTT-Radio

**Open-source push-to-talk voice communication over WebRTC.**

Hold a button (or keyboard hotkey) to speak. Release to send. Anyone in the same room hears you in real time — no telephony, no audio servers, no third-party services required. Audio travels directly peer-to-peer over encrypted WebRTC (SRTP/Opus), with a tiny WebSocket signaling relay for peer discovery only.

```
  ┌───────── Machine A ──────────┐      ┌───────── Machine B ──────────┐
  │  Browser  →  PTT-Radio UI    │      │    PTT-Radio UI  ←  Browser  │
  │  [HOLD PTT]  Opus 48kHz      │      │     Opus 48kHz  [PLAYS AUDIO]│
  └──────────┬───────────────────┘      └───────────────┬──────────────┘
             │   WebRTC P2P (SRTP/UDP)                  │
             └──────────────────────────────────────────┘
                           ↕ signaling only ↕
                   ┌───────────────────────────┐
                   │   PTT-Radio Signal Server │
                   │   WebSocket — port 3001   │
                   └───────────────────────────┘
```

---

## Features

- **True half-duplex PTT** — hold to transmit, release to end packet
- **WebRTC mesh** — encrypted peer-to-peer audio (SRTP), no audio touches the server
- **Opus codec** — 48 kHz, 20 ms frames, native to all modern browsers, zero WASM
- **Live VU meter** — 24-segment LED-style input level display
- **Oscilloscope waveform ring** — real-time canvas visualization during TX
- **Multi-peer rooms** — up to 8 peers per channel, unlimited channels
- **ICE restart** — automatic reconnection on network changes
- **Demo mode** — works fully offline, no signaling server needed for local testing
- **Rebindable hotkey** — any key, captured live via one-shot listener
- **Persisted settings** — localStorage: server URL, room, hotkey, gain, channel
- **Docker-ready** — multi-stage builds for both client (Nginx) and server (Node)
- **PWA manifest** — installable as a desktop/mobile web app

---

## Directory Structure

```
ptt-radio/
├── package.json               ← root scripts (dev, build, docker)
├── docker-compose.yml         ← full-stack Docker deployment
├── .gitignore
│
├── client/                    ← React + Vite frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html             ← HTML entry point
│   ├── Dockerfile             ← multi-stage: build → Nginx
│   ├── nginx.conf             ← SPA routing, security headers, gzip
│   └── public/
│       └── manifest.json      ← PWA manifest
│   └── src/
│       ├── main.jsx           ← React root mount
│       ├── App.jsx            ← root component
│       │
│       ├── engine/
│       │   └── PTTEngine.js   ← WebAudio + WebRTC + signaling core class
│       │
│       ├── hooks/
│       │   ├── usePTTEngine.js  ← React bindings, persisted settings, state
│       │   └── useKeyBind.js    ← keyboard PTT binding + live key capture
│       │
│       ├── components/
│       │   ├── PTTRadioApp.jsx      ← main assembled UI
│       │   ├── PTTButton.jsx        ← circular push-to-talk button
│       │   ├── VUMeter.jsx          ← 24-segment LED level display
│       │   ├── WaveformRing.jsx     ← canvas oscilloscope ring
│       │   ├── DisplayComponents.jsx← LCD, SignalBars, PeerBadge, Squelch
│       │   ├── SettingsPanel.jsx    ← config overlay with key capture
│       │   └── EventLog.jsx         ← terminal-style event log
│       │
│       └── styles/            ← (reserved for future CSS modules)
│
└── server/                    ← Node.js WebSocket signaling server
    ├── package.json
    ├── Dockerfile
    ├── .env.example
    └── src/
        └── index.js           ← WebSocket relay, rooms, heartbeat, /health
```

---

## QuickStart — Local Development

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- A modern browser with WebRTC support (Chrome 90+, Firefox 88+, Safari 15+, Edge 90+)
- Microphone access

### 1 — Clone and install

```bash
git clone https://github.com/david-spies/ptt-radio.git
cd ptt-radio
npm install          # installs root dev deps (concurrently)
npm run install:all  # installs client + server deps
```

### 2 — Start both services

```bash
npm run dev
```

This starts:
- **Client** on `http://localhost:5173` (Vite HMR)
- **Signal server** on `ws://localhost:3001` (Node --watch)

### 3 — Use the app

1. Open `http://localhost:5173` in your browser (two tabs to simulate two peers)
2. Click **INIT MIC** — grant microphone permission
3. Click **CFG** → set Signal Server to `ws://localhost:3001`, set a Room name (e.g. `test`)
4. Click **CONNECT** in both tabs
5. **Hold SPACE** (or your custom key) in one tab → the other tab plays audio

> **Demo mode:** If no signaling server is reachable, the app falls back to demo mode automatically. Mic and PTT still work for local level/waveform testing.

---

## QuickStart — Docker (Production)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2

### 1 — Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env — set ALLOWED_ORIGINS to your domain in production
```

### 2 — Build and start

```bash
npm run docker:up
# or directly:
docker compose up --build -d
```

Services:
- **Client** → `http://localhost:80`
- **Signal server** → `ws://localhost:3001`
- **Health check** → `http://localhost:3001/health`

### 3 — View logs

```bash
npm run docker:logs
```

### 4 — Stop

```bash
npm run docker:down
```

---

## Manual Production Deployment

### Signal Server (Node.js)

```bash
cd server
cp .env.example .env
# edit .env
npm install --omit=dev
node src/index.js
```

With PM2 for process management:

```bash
npm install -g pm2
pm2 start src/index.js --name ptt-radio-server
pm2 save
pm2 startup
```

### Client (Static Files)

```bash
cd client
npm install
npm run build
# dist/ contains the production static files
# Serve with any static file host: Nginx, Caddy, S3+CloudFront, Vercel, etc.
```

**Important:** The signaling server must use **WSS** (WebSocket Secure) in production because browsers block mixed content (HTTPS page → WS connection). Place it behind a TLS-terminating reverse proxy (Nginx, Caddy, Traefik) and expose it at `wss://your-domain.com/signal`.

Sample Caddy reverse proxy snippet:

```
your-domain.com {
    reverse_proxy /signal localhost:3001
    root * /var/www/ptt-radio/dist
    file_server
    try_files {path} /index.html
}
```

---

## Configuration Reference

### Settings Panel (CFG button in UI)

| Setting | Default | Description |
|---|---|---|
| Signal Server | *(blank — demo mode)* | WebSocket URL of the signaling server, e.g. `wss://signal.your-domain.com` |
| Room / Channel | `alpha-1` | Room name. Anyone with the same name joins the same channel. |
| PTT Hotkey | `Space` | Any keyboard key, captured live via the REBIND button |
| Input Device | Default Mic | Microphone device selection |
| Input Gain | 100% | Pre-transmit microphone amplification (0–300%) |
| Output Gain | 100% | Incoming peer audio volume (0–200%) |
| Channel | 1 | Display channel number (1–99), cosmetic only |

Settings are persisted to `localStorage` and restored on next load.

### Signal Server Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | TCP port to listen on |
| `MAX_ROOMS` | `500` | Maximum concurrent rooms |
| `MAX_PEERS` | `8` | Maximum peers per room |
| `HEARTBEAT_MS` | `20000` | WebSocket ping interval (ms) |
| `MSG_MAX_BYTES` | `65536` | Maximum message payload size (bytes) |
| `ALLOWED_ORIGINS` | *(open)* | Comma-separated allowed WebSocket origins |

---

## Architecture

### Audio Pipeline

```
Microphone
  └─ getUserMedia (48kHz, mono, echoCancellation, noiseSuppression)
       └─ MediaStreamSource
            └─ GainNode  (inputGain)
                 └─ AnalyserNode  (VU meter + waveform)

PTT DOWN → track.enabled = true  → audio flows into WebRTC sender
PTT UP   → track.enabled = false → silence (no data sent)

Incoming remote stream
  └─ MediaStreamSource
       └─ GainNode  (outputGain)
            └─ AudioDestination  (speakers)
```

Opus encoding happens natively inside the WebRTC stack — no manual encoding, no WASM, no worker threads.

### Signaling Protocol

The signaling server is a pure relay — it never inspects or buffers audio. It only:

1. Accepts `join` — adds peer to room, returns peer list, notifies existing peers
2. Routes `offer`, `answer`, `ice` — forwarded verbatim to the named `to` peer
3. Broadcasts `peer-left` when a connection closes
4. Runs a WebSocket heartbeat to detect zombie connections

After signaling is complete, all audio travels directly peer-to-peer via SRTP/UDP. The signaling server can go offline with no impact on in-progress calls.

### WebRTC Configuration

- **ICE policy:** `all` (direct, STUN, TURN fallback)
- **STUN servers:** Google public STUN (`stun.l.google.com:19302`, stun1–3)
- **ICE restart:** automatic on `failed` or `disconnected` state
- **Bundle policy:** `max-bundle` — single ICE transport for all streams
- **RTCP mux:** `require` — RTCP and RTP share a single UDP port

For networks with symmetric NAT (corporate firewalls), add your own TURN server to `ICE_SERVERS` in `client/src/engine/PTTEngine.js`.

---

## Browser Support

| Browser | Minimum Version | Notes |
|---|---|---|
| Chrome / Edge | 90 | Full support |
| Firefox | 88 | Full support |
| Safari | 15.4 | Requires user gesture before `getUserMedia` |
| Mobile Chrome | 90 | Hold button supported via touch events |
| Mobile Safari | 15.4 | Works; no keyboard hotkey on mobile |

WebRTC is blocked in HTTP contexts on mobile Safari — serve over HTTPS in production.

---

## Security Notes

- **No audio on server.** The signaling server only routes text messages. All audio is E2E-encrypted via SRTP between peers.
- **Set `ALLOWED_ORIGINS`** in production to prevent unauthorized clients from connecting to your signaling server.
- **Use TLS.** Deploy behind HTTPS/WSS. `getUserMedia` and WebRTC are blocked in insecure contexts by all modern browsers.
- **Room names are not passwords.** Anyone who knows a room name can join. Add an authentication layer (JWT in the join message, verified server-side) for private channels.
- **Peer IDs** are 8-character random alphanumeric strings generated client-side. They are not authenticated.

---

## Contributing

Pull requests welcome. Key areas for contribution:

- **TURN server integration** — configurable relay for symmetric NAT
- **Room authentication** — JWT or pre-shared key validation on join
- **Text chat** — WebRTC data channel alongside audio
- **Recording** — MediaRecorder API to save TX sessions locally
- **Electron wrapper** — system tray, global hotkeys, no browser needed
- **Tests** — unit tests for PTTEngine state machine

---

## License

MIT © PTT-Radio Contributors

---

## Acknowledgements

Built on open standards: [WebRTC](https://webrtc.org/), [Opus](https://opus-codec.org/), [WebAudio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

Inspired by [VoxShare](https://github.com/voxshare), [Mumble](https://www.mumble.info/), and [PTT4E](https://github.com/Zulko/ptt4e).
