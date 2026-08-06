import { memo, useCallback, useEffect, useRef, useState } from "react";
import { SuperneoSoundtrack } from "./soundtrackEngine";
import { STAGE_CHANGE_EVENT, type StageChangeDetail } from "./stageSignal";
import { TIP_SIGNAL_EVENT, type TipArrival } from "./tipSignal";

const defaultVolume = 46;
const deviceVolumeMedia = "(max-width: 720px), (hover: none) and (pointer: coarse)";

export const SoundtrackController = memo(function SoundtrackController() {
  const engineRef = useRef<SuperneoSoundtrack | null>(null);
  const stageRef = useRef(0);
  const volumeRef = useRef(defaultVolume);
  const startingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [supported] = useState(() => SuperneoSoundtrack.isSupported());
  const [volume, setVolumeState] = useState(defaultVolume);
  const [deviceVolume, setDeviceVolume] = useState(
    () => window.matchMedia(deviceVolumeMedia).matches,
  );

  const ensureEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new SuperneoSoundtrack({ compact: deviceVolume });
      engineRef.current.setVolume(deviceVolume ? 1 : volumeRef.current / 100);
      engineRef.current.setStage(stageRef.current);
    }
    return engineRef.current;
  }, [deviceVolume]);

  const play = useCallback(async () => {
    if (!supported || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const engine = ensureEngine();
      await engine.play();
      setPlaying(true);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    } catch {
      setPlaying(false);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [ensureEngine, supported]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setPlaying(false);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  }, []);

  const togglePlayback = () => {
    if (playing) pause();
    else void play();
  };

  const setVolume = (nextVolume: number) => {
    const safeVolume = Math.min(100, Math.max(0, nextVolume));
    volumeRef.current = safeVolume;
    setVolumeState(safeVolume);
    if (!deviceVolume) engineRef.current?.setVolume(safeVolume / 100);
    try {
      window.localStorage.setItem("superneo-volume", String(safeVolume));
    } catch {
      // Playback still works when storage is unavailable in private contexts.
    }
  };

  useEffect(() => {
    const query = window.matchMedia(deviceVolumeMedia);
    const updateMode = () => setDeviceVolume(query.matches);
    updateMode();
    query.addEventListener("change", updateMode);
    return () => query.removeEventListener("change", updateMode);
  }, []);

  useEffect(() => {
    engineRef.current?.setVolume(deviceVolume ? 1 : volumeRef.current / 100);
  }, [deviceVolume]);

  useEffect(() => {
    try {
      const storedVolume = Number(window.localStorage.getItem("superneo-volume"));
      if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100) {
        volumeRef.current = storedVolume;
        setVolumeState(storedVolume);
      }
    } catch {
      // Keep the default volume when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const syncStage = (event: Event) => {
      const { stage } = (event as CustomEvent<StageChangeDetail>).detail;
      stageRef.current = stage;
      engineRef.current?.setStage(stage);
    };

    window.addEventListener(STAGE_CHANGE_EVENT, syncStage);
    return () => window.removeEventListener(STAGE_CHANGE_EVENT, syncStage);
  }, []);

  useEffect(() => {
    const playTipArrivals = (event: Event) => {
      if (!supported) return;
      const { arrivals } = (event as CustomEvent<{ arrivals: TipArrival[] }>).detail;
      void ensureEngine().playTipArrivals(arrivals).catch(() => {
        // A later pointer gesture can retry if the browser interrupts audio startup.
      });
    };

    window.addEventListener(TIP_SIGNAL_EVENT, playTipArrivals);
    return () => window.removeEventListener(TIP_SIGNAL_EVENT, playTipArrivals);
  }, [ensureEngine, supported]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if ("MediaMetadata" in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "superneo.ai",
        artist: "superneo.ai",
        album: "In the making.",
      });
    }
    const setAction = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some mobile browsers expose Media Session but omit individual actions.
      }
    };
    setAction("play", () => { void play(); });
    setAction("pause", pause);
    setAction("stop", pause);
    return () => {
      setAction("play", null);
      setAction("pause", null);
      setAction("stop", null);
    };
  }, [pause, play]);

  useEffect(() => () => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  return (
    <section
      className="soundtrack-control"
      data-playing={playing}
      data-mode={deviceVolume ? "device" : "trim"}
      data-no-scene="true"
      aria-label="Soundtrack controls"
    >
      <button
        className="soundtrack-toggle"
        type="button"
        onClick={togglePlayback}
        disabled={!supported || starting}
        aria-busy={starting}
        aria-controls={deviceVolume ? undefined : "soundtrack-volume"}
        aria-label={playing ? "Pause soundtrack" : "Play soundtrack"}
        aria-pressed={playing}
      >
        <span className="soundtrack-ready-icon" aria-hidden="true">♫</span>
        <span className="soundtrack-bars" aria-hidden="true"><i /><i /><i /></span>
      </button>
      {!deviceVolume && (
        <label id="soundtrack-volume" className="soundtrack-volume">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(event) => setVolume(Number(event.currentTarget.value))}
            aria-label="Soundtrack volume"
            aria-valuetext={`${volume} percent`}
          />
        </label>
      )}
    </section>
  );
});
