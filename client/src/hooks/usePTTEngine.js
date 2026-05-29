import { useState, useEffect, useRef, useCallback } from "react";
import { PTTEngine } from "../engine/PTTEngine.js";

const DEFAULT_SETTINGS = {
  signalingUrl: "",       // set at connect time
  room: "alpha-1",
  pttKey: "Space",
  inputDevice: "",
  inputGain: 1.0,
  outputGain: 1.0,
  channel: 1,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem("ptt-radio:settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem("ptt-radio:settings", JSON.stringify(s));
  } catch { /* storage may be unavailable */ }
}

/**
 * usePTTEngine — single hook that owns the entire PTTEngine lifecycle.
 *
 * Returns everything the UI needs to render and interact with the radio.
 */
export function usePTTEngine() {
  const engineRef  = useRef(null);

  // ── Persisted settings
  const [settings, _setSettings] = useState(loadSettings);
  const setSettings = useCallback((next) => {
    _setSettings(next);
    saveSettings(next);
  }, []);

  // ── Dynamic state
  const [appState,       setAppState]       = useState("idle");   // idle | initializing | ready | connected
  const [sigState,       setSigState]       = useState("idle");   // idle | connecting | connected | demo | disconnected
  const [transmitting,   setTransmitting]   = useState(false);
  const [levelDb,        setLevelDb]        = useState(-120);
  const [peers,          setPeers]          = useState([]);
  const [lastTxDuration, setLastTxDuration] = useState(0);
  const [devices,        setDevices]        = useState({ inputs: [], outputs: [] });
  const [eventLog,       setEventLog]       = useState([]);

  // Expose analyser to waveform canvas
  const analyserRef = useRef(null);

  // ── Engine event handler
  const handleEvent = useCallback((event) => {
    const { type, ...payload } = event;

    setEventLog((prev) => [
      { time: new Date().toISOString().slice(11, 19), type, payload },
      ...prev.slice(0, 49),
    ]);

    switch (type) {
      case "audioReady":
        setAppState("ready");
        break;

      case "level":
        setLevelDb(payload.db);
        break;

      case "signalingState":
        setSigState(payload.state);
        if (payload.state === "connected" || payload.state === "demo") {
          setAppState("connected");
        } else if (payload.state === "disconnected" || payload.state === "idle") {
          setAppState((prev) => (prev === "connected" ? "ready" : prev));
          setPeers([]);
        }
        break;

      case "transmitting":
        setTransmitting(payload.active);
        if (!payload.active && payload.duration != null) {
          setLastTxDuration(payload.duration);
        }
        break;

      case "peerJoined":
        setPeers((p) => {
          if (p.find((x) => x.id === payload.peerId)) return p;
          return [...p, { id: payload.peerId, state: "connecting" }];
        });
        break;

      case "peerConnected":
      case "peerState":
        setPeers((p) =>
          p.map((x) => x.id === payload.peerId ? { ...x, state: payload.state || "connected" } : x)
        );
        break;

      case "peerLeft":
        setPeers((p) => p.filter((x) => x.id !== payload.peerId));
        break;

      case "peerList":
        setPeers((payload.peers || []).map((id) => ({ id, state: "connecting" })));
        break;
    }
  }, []);

  // ── Create engine once
  useEffect(() => {
    const engine = new PTTEngine(handleEvent);
    engineRef.current = engine;

    // Load persisted settings into engine
    engine.setInputGain(loadSettings().inputGain);
    engine.setOutputGain(loadSettings().outputGain);

    // Enumerate audio devices (may be empty before permission granted)
    navigator.mediaDevices?.enumerateDevices()
      .then((devs) => setDevices({
        inputs:  devs.filter((d) => d.kind === "audioinput"),
        outputs: devs.filter((d) => d.kind === "audiooutput"),
      }))
      .catch(() => {});

    return () => {
      engine.disconnect();
      engineRef.current = null;
    };
  }, [handleEvent]);

  // ── Sync gain settings to engine when they change
  useEffect(() => {
    engineRef.current?.setInputGain(settings.inputGain);
    engineRef.current?.setOutputGain(settings.outputGain);
  }, [settings.inputGain, settings.outputGain]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const initAudio = useCallback(async (deviceId) => {
    setAppState("initializing");
    try {
      const engine = engineRef.current;
      await engine.initAudio(deviceId || settings.inputDevice || null);
      analyserRef.current = engine.analyserNode;

      // Re-enumerate with labels now that permission is granted
      const devs = await engine.getAudioDevices();
      setDevices(devs);
    } catch (err) {
      console.error("[PTT] initAudio error:", err);
      setAppState("idle");
      throw err;
    }
  }, [settings.inputDevice]);

  const connectToRoom = useCallback(async (url, room) => {
    const engine = engineRef.current;
    if (!engine || appState === "idle") return;
    await engine.connect(url, room);
  }, [appState]);

  const disconnectFromRoom = useCallback(() => {
    engineRef.current?.disconnect();
    setSigState("idle");
    setAppState("ready");
    setPeers([]);
  }, []);

  const startTransmit = useCallback(() => {
    engineRef.current?.startTransmit();
  }, []);

  const stopTransmit = useCallback(() => {
    engineRef.current?.stopTransmit();
  }, []);

  const peerId = engineRef.current?.peerId ?? "--------";

  return {
    // State
    appState,
    sigState,
    transmitting,
    levelDb,
    peers,
    lastTxDuration,
    devices,
    eventLog,
    settings,
    peerId,

    // Refs
    analyserRef,

    // Actions
    setSettings,
    initAudio,
    connectToRoom,
    disconnectFromRoom,
    startTransmit,
    stopTransmit,
  };
}
