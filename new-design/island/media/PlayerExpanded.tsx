import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMediaStore } from "../../store/mediaStore";
import { useIslandStore } from "../../store/islandStore";
import { useSettingsStore } from "../../store/settingsStore";
import {
  BatteryIcon,
  BluetoothIcon,
  BoltIcon,
  CloseIcon,
  LeafIcon,
  NextIcon,
  NoteIcon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  PrevIcon,
  SpeakerIcon,
  WifiIcon,
} from "../icons";

type View = "music" | "controls" | "alerts";

const VIEWS: { id: View; label: string }[] = [
  { id: "music", label: "Music" },
  { id: "controls", label: "Controls" },
  { id: "alerts", label: "Alerts" },
];

const TAB_WIDTH = 74; // keep in sync with .nt-tabs in index.css
const CONTROLS_POLL_MS = 3000;

function formatTime(ms: number): string {
  if (!ms || ms < 0 || Number.isNaN(ms)) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/* ------------------------------------------------------------------ */
/* System controls (Wi-Fi, Bluetooth, Energy saver, Battery)           */
/* ------------------------------------------------------------------ */
interface SystemControlsState {
  wifiEnabled: boolean;
  wifiName: string | null;
  bluetoothEnabled: boolean;
  energySaverEnabled: boolean;
  batteryLevel: number;
  isCharging: boolean;
}

function useSystemControls(active: boolean) {
  const [wifiOn, setWifiOn] = useState(true);
  const [wifiName, setWifiName] = useState<string>("Connected");
  const [bluetoothOn, setBluetoothOn] = useState(false);
  const [saverOn, setSaverOn] = useState(false);
  const [battery, setBattery] = useState(1);
  const [charging, setCharging] = useState(false);

  const refresh = useCallback(() => {
    invoke<SystemControlsState>("system_get_controls")
      .then((res) => {
        if (!res) return;
        setWifiOn(res.wifiEnabled);
        setWifiName(res.wifiName || (res.wifiEnabled ? "Connected" : "Off"));
        setBluetoothOn(res.bluetoothEnabled);
        setSaverOn(res.energySaverEnabled);
        if (typeof res.batteryLevel === "number" && !Number.isNaN(res.batteryLevel)) {
          setBattery(res.batteryLevel);
        }
        setCharging(res.isCharging);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll only while the panel is open.
  useEffect(() => {
    if (!active) return;
    refresh();
    const timer = window.setInterval(refresh, CONTROLS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, refresh]);

  const toggleWifi = () => {
    const next = !wifiOn;
    setWifiOn(next);
    invoke("system_toggle_wifi", { enable: next }).then(refresh).catch(() => {});
  };
  const toggleBluetooth = () => {
    const next = !bluetoothOn;
    setBluetoothOn(next);
    invoke("system_toggle_bluetooth", { enable: next }).then(refresh).catch(() => {});
  };
  const toggleSaver = () => {
    setSaverOn(!saverOn);
    invoke("system_toggle_energy_saver").then(refresh).catch(() => {});
  };

  return { wifiOn, wifiName, bluetoothOn, saverOn, battery, charging, toggleWifi, toggleBluetooth, toggleSaver };
}

/* ------------------------------------------------------------------ */
/* Master volume                                                       */
/* ------------------------------------------------------------------ */
function useVolume(active: boolean) {
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const lastAudible = useRef(0.5);
  const dragging = useRef(false);

  useEffect(() => {
    if (!active) return;
    invoke<number>("media_get_volume")
      .then((v) => {
        if (typeof v !== "number" || Number.isNaN(v)) return;
        const c = Math.max(0, Math.min(1, v));
        setVolume(c);
        setMuted(c === 0);
        if (c > 0) lastAudible.current = c;
      })
      .catch(() => {});
  }, [active]);

  // Follow the keyboard volume keys without polling.
  useEffect(() => {
    let off: (() => void) | null = null;
    let disposed = false;
    listen<{ volume: number; muted: boolean }>("volume://change", (e) => {
      if (dragging.current) return;
      const v = Math.max(0, Math.min(1, e.payload.volume));
      setVolume(v);
      setMuted(e.payload.muted || v === 0);
      if (v > 0) lastAudible.current = v;
    })
      .then((un) => (disposed ? un() : (off = un)))
      .catch(() => {});
    return () => {
      disposed = true;
      off?.();
    };
  }, []);

  const change = useCallback((ratio: number, commit: boolean, isDrag = false) => {
    dragging.current = isDrag;
    const r = Math.max(0, Math.min(1, ratio));
    setVolume(r);
    setMuted(r === 0);
    if (r > 0) lastAudible.current = r;
    if (commit) invoke("media_set_volume", { volume: r }).catch(() => {});
  }, []);

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  const toggleMute = useCallback(() => {
    if (muted || volume === 0) change(lastAudible.current || 0.5, true);
    else change(0, true);
  }, [muted, volume, change]);

  return { volume: muted ? 0 : volume, muted, change, endDrag, toggleMute };
}

function VolumeSlider({
  volume,
  muted,
  onChange,
  onEnd,
  onToggleMute,
  showValue = true,
}: {
  volume: number;
  muted: boolean;
  onChange: (ratio: number, commit: boolean, isDrag?: boolean) => void;
  onEnd: () => void;
  onToggleMute: () => void;
  showValue?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastSent = useRef(0);

  const ratioFrom = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const r = ratioFrom(e.clientX);
    if (r === null) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastSent.current = performance.now();
    onChange(r, true, true);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const r = ratioFrom(e.clientX);
    if (r === null) return;
    const now = performance.now();
    const commit = now - lastSent.current > 40; // cap native calls while dragging
    if (commit) lastSent.current = now;
    onChange(r, commit, true);
  };

  const onUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = false;
    const r = ratioFrom(e.clientX);
    if (r !== null) onChange(r, true, true);
    onEnd();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = 0.05;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(volume + step, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(volume - step, true);
    }
  };

  return (
    <div className="nt-slider">
      <button
        type="button"
        className="nt-slider-mute"
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
      >
        <SpeakerIcon size={17} level={volume} muted={muted} />
      </button>
      <div
        ref={trackRef}
        className="nt-slider-track"
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(volume * 100)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <div className="nt-slider-rail">
          <div
            className="nt-slider-fill"
            data-muted={muted}
            style={{ transform: `scaleX(${volume})`, transition: "transform 60ms ease-out" }}
          />
        </div>
      </div>
      {showValue && <span className="nt-slider-value">{Math.round(volume * 100)}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */
function MusicView({
  active,
  vol,
}: {
  active: boolean;
  vol: ReturnType<typeof useVolume>;
}) {
  const snapshot = useMediaStore((s) => s.snapshot);
  const thumbnailUrl = useMediaStore((s) => s.thumbnailUrl);
  const { hasSession, title, artist, isPlaying, playbackRate, positionMs, durationMs, canPlayPause, canNext, canPrevious } = snapshot;

  // Position is extrapolated in Rust; between events we advance once per second, only while visible.
  const [position, setPosition] = useState(positionMs);
  useEffect(() => setPosition(positionMs), [positionMs, snapshot.title]);

  useEffect(() => {
    if (!active || !hasSession || !isPlaying || durationMs <= 0) return;
    const timer = window.setInterval(() => {
      setPosition((p) => Math.min(p + 1000 * (playbackRate || 1), durationMs));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, hasSession, isPlaying, durationMs, playbackRate]);

  const empty = !hasSession || !title;
  const duration = empty ? 0 : Math.max(0, durationMs);
  const elapsed = empty ? 0 : Math.max(0, position);
  const ratio = duration > 0 ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
  const live = isPlaying && !empty;

  const act = (cmd: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    invoke(cmd).catch(() => {});
  };

  return (
    <div className="nt-music">
      <div className="nt-art">
        {thumbnailUrl && !empty ? <img src={thumbnailUrl} alt="" /> : <NoteIcon size={40} />}
      </div>

      <div className="nt-music-col">
        <div>
          <div className="nt-title">{empty ? "Nothing playing" : title}</div>
          <div className="nt-artist">
            {empty ? "Play something in any app and it appears here" : artist || "Unknown artist"}
          </div>
        </div>

        <div className="nt-progress">
          <div className="nt-ticks-wrap">
            <div
              className="nt-ticks"
              role="progressbar"
              aria-label="Track progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 100)}
            >
              <div className="nt-ticks-base" />
              <div
                className="nt-ticks-fill"
                data-live={live}
                style={{ clipPath: `inset(0 ${(1 - ratio) * 100}% 0 0)` }}
              />
            </div>
            {!empty && duration > 0 && (
              <div className="nt-playhead" data-live={live} style={{ left: `${ratio * 100}%` }} />
            )}
          </div>
          <div className="nt-times">
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="nt-transport">
          <div className="nt-transport-btns">
            <button
              type="button"
              className="nt-skip"
              aria-label="Previous track"
              disabled={!hasSession || !canPrevious}
              onClick={act("media_previous")}
            >
              <PrevIcon size={18} />
            </button>
            <button
              type="button"
              className="nt-play"
              aria-label={isPlaying ? "Pause" : "Play"}
              disabled={!hasSession || !canPlayPause}
              onClick={act("media_play_pause")}
            >
              {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>
            <button
              type="button"
              className="nt-skip"
              aria-label="Next track"
              disabled={!hasSession || !canNext}
              onClick={act("media_next")}
            >
              <NextIcon size={18} />
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0, maxWidth: 190 }}>
            <VolumeSlider
              volume={vol.volume}
              muted={vol.muted}
              onChange={vol.change}
              onEnd={vol.endDrag}
              onToggleMute={vol.toggleMute}
              showValue={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlsView({
  sys,
  vol,
}: {
  sys: ReturnType<typeof useSystemControls>;
  vol: ReturnType<typeof useVolume>;
}) {
  const tile = (
    pressed: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    label: string,
    state: string,
  ) => (
    <button
      type="button"
      className="nt-tile"
      aria-pressed={pressed}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {icon}
      <div style={{ minWidth: 0, maxWidth: "100%" }}>
        <div className="nt-tile-label">{label}</div>
        <div className="nt-tile-state">{state}</div>
      </div>
    </button>
  );

  return (
    <div className="nt-controls">
      <div className="nt-tiles">
        {tile(sys.wifiOn, sys.toggleWifi, <WifiIcon size={22} off={!sys.wifiOn} />, "Wi-Fi", sys.wifiOn ? sys.wifiName : "Off")}
        {tile(sys.bluetoothOn, sys.toggleBluetooth, <BluetoothIcon size={22} off={!sys.bluetoothOn} />, "Bluetooth", sys.bluetoothOn ? "On" : "Off")}
        {tile(sys.saverOn, sys.toggleSaver, <LeafIcon size={22} />, "Energy saver", sys.saverOn ? "On" : "Off")}
      </div>
      <div className="nt-volume-panel">
        <VolumeSlider
          volume={vol.volume}
          muted={vol.muted}
          onChange={vol.change}
          onEnd={vol.endDrag}
          onToggleMute={vol.toggleMute}
        />
      </div>
    </div>
  );
}

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className="nt-switch"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    />
  );
}

function AlertsView() {
  const s = useSettingsStore();
  const master = s.liveActivitiesEnabled;

  const rows: { label: string; on: boolean; set: (v: boolean) => void }[] = [
    { label: "Bluetooth devices", on: s.bluetoothActivitiesEnabled, set: s.setBluetoothActivitiesEnabled },
    { label: "Wi-Fi", on: s.wifiActivitiesEnabled, set: s.setWifiActivitiesEnabled },
    { label: "Volume", on: s.volumeActivitiesEnabled, set: s.setVolumeActivitiesEnabled },
    { label: "Charger", on: s.chargingActivitiesEnabled, set: s.setChargingActivitiesEnabled },
    { label: "Low battery", on: s.batteryLowActivitiesEnabled, set: s.setBatteryLowActivitiesEnabled },
  ];

  return (
    <div className="nt-alerts">
      <div className="nt-alert-row" data-master="true">
        <div>
          Live alerts
          <small>Show a banner when something changes on your PC</small>
        </div>
        <Switch on={master} label="Live alerts" onChange={s.setLiveActivitiesEnabled} />
      </div>
      {rows.map((r) => (
        <div key={r.label} className="nt-alert-row" data-dim={!master}>
          <span>{r.label}</span>
          <Switch on={r.on} label={r.label} disabled={!master} onChange={r.set} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */
interface PlayerExpandedProps {
  isExpanded?: boolean;
}

export function PlayerExpanded({ isExpanded = true }: PlayerExpandedProps) {
  const toIdle = useIslandStore((s) => s.toIdle);
  const pinned = useIslandStore((s) => s.pinned);
  const setPinned = useIslandStore((s) => s.setPinned);

  const [view, setView] = useState<View>("music");

  // Return to Music after the panel has finished closing, so the reset is never seen.
  useEffect(() => {
    if (isExpanded) return;
    const t = window.setTimeout(() => setView("music"), 400);
    return () => window.clearTimeout(t);
  }, [isExpanded]);

  const sys = useSystemControls(isExpanded);
  const vol = useVolume(isExpanded);

  const lowBattery = sys.battery <= 0.2 && !sys.charging;
  const batteryColor = sys.charging ? "var(--nt-charge)" : lowBattery ? "var(--nt-alarm)" : undefined;
  const viewIndex = VIEWS.findIndex((v) => v.id === view);

  return (
    <div className="nt-root" data-open={isExpanded} inert={!isExpanded} onClick={(e) => e.stopPropagation()}>
      <div className="nt-header">
        <div className="nt-tabs" role="tablist" aria-label="Island views">
          <div className="nt-tabs-thumb" style={{ transform: `translateX(${viewIndex * TAB_WIDTH}px)` }} />
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              className="nt-tab"
              aria-selected={view === v.id}
              onClick={(e) => {
                e.stopPropagation();
                setView(v.id);
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="nt-status">
          <div className="nt-battery-chip" style={{ color: batteryColor }} title={sys.charging ? "Charging" : "On battery"}>
            {sys.charging ? <BoltIcon size={13} /> : <BatteryIcon size={16} level={sys.battery} />}
            <span>{Math.round(sys.battery * 100)}%</span>
          </div>
          <button
            type="button"
            className="nt-icon-btn"
            aria-label={pinned ? "Unpin panel" : "Keep panel open"}
            aria-pressed={pinned}
            onClick={(e) => {
              e.stopPropagation();
              setPinned(!pinned);
            }}
          >
            <PinIcon size={15} filled={pinned} />
          </button>
          <button
            type="button"
            className="nt-icon-btn"
            aria-label="Close panel"
            onClick={(e) => {
              e.stopPropagation();
              toIdle();
            }}
          >
            <CloseIcon size={15} />
          </button>
        </div>
      </div>

      {/* key remounts the view so it plays its entrance when the user switches tabs */}
      <div className="nt-view" key={view}>
        {view === "music" && <MusicView active={isExpanded} vol={vol} />}
        {view === "controls" && <ControlsView sys={sys} vol={vol} />}
        {view === "alerts" && <AlertsView />}
      </div>
    </div>
  );
}
