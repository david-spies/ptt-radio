// ─── PTTEngine ────────────────────────────────────────────────────────────────
// Core audio capture, Opus encoding (native via WebRTC), WebRTC P2P mesh,
// WebSocket signaling, and PTT transmit gating.
//
// Usage:
//   const engine = new PTTEngine(eventCallback);
//   await engine.initAudio(deviceId?);
//   await engine.connect(signalingUrl, roomId);
//   engine.startTransmit();
//   engine.stopTransmit();
//   engine.disconnect();
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_RATE = 48000;
export const CHANNELS = 1;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

// Maximum peers allowed per room
const MAX_PEERS = 8;

// Signaling connection timeout before falling back to demo mode (ms)
const CONNECT_TIMEOUT_MS = 4000;

export class PTTEngine {
  constructor(onEvent) {
    this.onEvent = onEvent;

    // Audio graph nodes
    this.audioCtx = null;
    this.micStream = null;
    this.inputGainNode = null;
    this.outputGainNode = null;
    this.analyserNode = null;

    // WebRTC
    this.peers = new Map(); // peerId → { pc, audio }

    // Signaling
    this.ws = null;
    this.roomId = null;
    this.peerId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

    // State
    this.transmitting = false;
    this.connected = false;
    this.signalingState = "idle";
    this.inputGain = 1.0;
    this.outputGain = 1.0;

    // Internal
    this._levelInterval = null;
    this._txStart = 0;
    this._destroyed = false;
  }

  // ── Event emission ──────────────────────────────────────────────────────────
  emit(type, payload = {}) {
    if (!this._destroyed) this.onEvent({ type, ...payload });
  }

  // ── Audio initialization ────────────────────────────────────────────────────
  async initAudio(deviceId = null) {
    if (this.audioCtx) {
      await this.audioCtx.close().catch(() => {});
    }

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SAMPLE_RATE,
      latencyHint: "interactive",
    });

    const constraints = {
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        sampleRate: { ideal: SAMPLE_RATE },
        channelCount: { exact: CHANNELS },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    this.micStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Build audio graph
    const source = this.audioCtx.createMediaStreamSource(this.micStream);

    this.inputGainNode = this.audioCtx.createGain();
    this.inputGainNode.gain.value = this.inputGain;

    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 1024;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.outputGainNode = this.audioCtx.createGain();
    this.outputGainNode.gain.value = this.outputGain;
    this.outputGainNode.connect(this.audioCtx.destination);

    source.connect(this.inputGainNode);
    this.inputGainNode.connect(this.analyserNode);

    // Mute mic track by default — PTT enables it
    this._setMicEnabled(false);

    this.emit("audioReady");
    this._startLevelMonitor();
    return true;
  }

  _setMicEnabled(enabled) {
    if (!this.micStream) return;
    for (const track of this.micStream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }

  _startLevelMonitor() {
    if (this._levelInterval) clearInterval(this._levelInterval);
    const buf = new Float32Array(this.analyserNode?.fftSize || 1024);

    this._levelInterval = setInterval(() => {
      if (!this.analyserNode) return;
      this.analyserNode.getFloatTimeDomainData(buf);
      let rms = 0;
      for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / buf.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -120;
      this.emit("level", { db, rms });
    }, 30);
  }

  setInputGain(v) {
    this.inputGain = Math.max(0, Math.min(4, v));
    if (this.inputGainNode) this.inputGainNode.gain.value = this.inputGain;
  }

  setOutputGain(v) {
    this.outputGain = Math.max(0, Math.min(3, v));
    if (this.outputGainNode) this.outputGainNode.gain.value = this.outputGain;
  }

  // ── Signaling ───────────────────────────────────────────────────────────────
  async connect(signalingUrl, roomId) {
    if (!signalingUrl || !roomId) {
      this._enterDemoMode(roomId || "local");
      return true;
    }

    this.roomId = roomId;
    this.signalingState = "connecting";
    this.emit("signalingState", { state: "connecting" });

    return new Promise((resolve) => {
      let ws;
      try {
        ws = new WebSocket(signalingUrl);
      } catch {
        this._enterDemoMode(roomId);
        return resolve(true);
      }

      const timeout = setTimeout(() => {
        ws.close();
        this._enterDemoMode(roomId);
        resolve(true);
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.ws = ws;
        ws.send(JSON.stringify({ type: "join", room: roomId, peer: this.peerId }));
        this.signalingState = "connected";
        this.connected = true;
        this.emit("signalingState", { state: "connected", roomId, peerId: this.peerId });
        resolve(true);
      };

      ws.onmessage = (e) => {
        try {
          this._handleSignal(JSON.parse(e.data));
        } catch (err) {
          console.warn("[PTT] Bad signal message:", err);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        if (!this.connected) {
          this._enterDemoMode(roomId);
          resolve(true);
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (this.connected) {
          this.connected = false;
          this.signalingState = "disconnected";
          this.emit("signalingState", { state: "disconnected" });
        }
      };
    });
  }

  _enterDemoMode(roomId) {
    this.signalingState = "demo";
    this.connected = true;
    this.roomId = roomId;
    this.emit("signalingState", { state: "demo", roomId, peerId: this.peerId });
    this.emit("peerList", { peers: [] });
  }

  _sendSignal(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── Signal message dispatch ─────────────────────────────────────────────────
  async _handleSignal(msg) {
    const { type, from, to, data } = msg;

    // Drop messages not addressed to us
    if (to && to !== this.peerId) return;

    switch (type) {
      case "peer-joined":
        if (this.peers.size < MAX_PEERS) {
          this.emit("peerJoined", { peerId: from });
          await this._createOffer(from);
        }
        break;

      case "peer-left":
        this._removePeer(from);
        break;

      case "peer-list":
        this.emit("peerList", { peers: data });
        for (const pid of data) {
          if (this.peers.size < MAX_PEERS) await this._createOffer(pid);
        }
        break;

      case "offer":
        await this._handleOffer(from, data);
        break;

      case "answer": {
        const peer = this.peers.get(from);
        if (peer) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data));
        }
        break;
      }

      case "ice": {
        const peer = this.peers.get(from);
        if (peer && data) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(data));
          } catch {
            // Stale candidate — safe to ignore
          }
        }
        break;
      }
    }
  }

  // ── WebRTC peer management ──────────────────────────────────────────────────
  _createPeer(peerId) {
    if (this.peers.has(peerId)) return this.peers.get(peerId);

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    // Add muted mic track — PTT toggles enabled flag
    if (this.micStream) {
      for (const track of this.micStream.getAudioTracks()) {
        const sender = pc.addTrack(track, this.micStream);
        // Ensure track starts muted
        if (sender.track) sender.track.enabled = this.transmitting;
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this._sendSignal({ type: "ice", from: this.peerId, to: peerId, data: candidate });
      }
    };

    pc.ontrack = ({ streams }) => {
      if (streams?.[0]) this._attachRemoteStream(peerId, streams[0]);
    };

    pc.onconnectionstatechange = () => {
      this.emit("peerState", { peerId, state: pc.connectionState });
      if (pc.connectionState === "failed") {
        // Attempt ICE restart
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected") {
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") pc.restartIce();
        }, 3000);
      }
    };

    const peerInfo = { pc, peerId };
    this.peers.set(peerId, peerInfo);
    return peerInfo;
  }

  async _createOffer(peerId) {
    const { pc } = this._createPeer(peerId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    this._sendSignal({ type: "offer", from: this.peerId, to: peerId, data: offer });
  }

  async _handleOffer(peerId, offer) {
    const { pc } = this._createPeer(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this._sendSignal({ type: "answer", from: this.peerId, to: peerId, data: answer });
  }

  _attachRemoteStream(peerId, stream) {
    // Route through output gain if WebAudio context is ready
    if (this.audioCtx && this.outputGainNode) {
      try {
        const src = this.audioCtx.createMediaStreamSource(stream);
        src.connect(this.outputGainNode);
      } catch {
        this._fallbackAudio(stream);
      }
    } else {
      this._fallbackAudio(stream);
    }

    const peer = this.peers.get(peerId);
    if (peer) peer.remoteStream = stream;
    this.emit("peerConnected", { peerId });
  }

  _fallbackAudio(stream) {
    const el = new Audio();
    el.srcObject = stream;
    el.autoplay = true;
    el.play().catch(() => {});
  }

  _removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    try { peer.pc.close(); } catch { /* noop */ }
    this.peers.delete(peerId);
    this.emit("peerLeft", { peerId });
  }

  // ── PTT transmit control ────────────────────────────────────────────────────
  startTransmit() {
    if (!this.connected || this.transmitting) return;
    this.transmitting = true;
    this._txStart = Date.now();

    // Resume suspended context (browser autoplay policy)
    if (this.audioCtx?.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    // Enable mic track across all peer connections
    for (const { pc } of this.peers.values()) {
      pc.getSenders().forEach((s) => {
        if (s.track?.kind === "audio") s.track.enabled = true;
      });
    }
    // Also enable the raw stream track (for level metering)
    this._setMicEnabled(true);

    this.emit("transmitting", { active: true });
  }

  stopTransmit() {
    if (!this.transmitting) return;
    this.transmitting = false;
    const duration = Date.now() - this._txStart;

    for (const { pc } of this.peers.values()) {
      pc.getSenders().forEach((s) => {
        if (s.track?.kind === "audio") s.track.enabled = false;
      });
    }
    this._setMicEnabled(false);

    this.emit("transmitting", { active: false, duration });
  }

  // ── Device enumeration ──────────────────────────────────────────────────────
  async getAudioDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: devices.filter((d) => d.kind === "audioinput"),
      outputs: devices.filter((d) => d.kind === "audiooutput"),
    };
  }

  // ── Teardown ────────────────────────────────────────────────────────────────
  disconnect() {
    this._destroyed = false; // allow final events
    this.stopTransmit();

    if (this._levelInterval) {
      clearInterval(this._levelInterval);
      this._levelInterval = null;
    }

    for (const [id] of this.peers) this._removePeer(id);

    try { this.ws?.close(); } catch { /* noop */ }
    this.ws = null;

    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;

    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;

    this.connected = false;
    this.signalingState = "idle";
    this.emit("signalingState", { state: "idle" });

    this._destroyed = true;
  }
}
