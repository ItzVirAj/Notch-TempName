import { useIslandStore, CollapsedMode } from "../../store/islandStore";
import { useMediaStore } from "../../store/mediaStore";
import {
  Music2,
  BatteryMedium,
  BatteryCharging,
  BatteryLow,
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
  Plane,
  Radio,
  ChevronRight,
} from "lucide-react";


// Determine numeric width for the collapsed pill based on mode
export const getPillWidthNumeric = (mode: CollapsedMode): number => {
  switch (mode) {
    case "charging_connected":
      return 330;
    case "charging_disconnected":
      return 310;
    case "wifi_connected":
      return 330;
    case "wifi_disconnected":
      return 290;
    case "bluetooth_connected":
      return 320;
    case "bluetooth_disconnected":
      return 290;
    case "airplane_on":
    case "airplane_off":
      return 300;
    case "low_power":
      return 290;
    case "music":
    default:
      return 350;
  }
};

// Determine dynamic CSS class width for the collapsed pill based on mode
export const getPillWidth = (mode: CollapsedMode): string => {
  switch (mode) {
    case "charging_connected":
      return "w-[330px]";
    case "charging_disconnected":
      return "w-[310px]";
    case "wifi_connected":
      return "w-[330px]";
    case "wifi_disconnected":
      return "w-[290px]";
    case "bluetooth_connected":
      return "w-[320px]";
    case "bluetooth_disconnected":
      return "w-[290px]";
    case "airplane_on":
    case "airplane_off":
      return "w-[300px]";
    case "low_power":
      return "w-[290px]";
    case "music":
    default:
      return "w-[350px]";
  }
};

export function IslandCollapsedContent() {
  const collapsedMode = useIslandStore((s) => s.collapsedMode);
  const snapshot = useMediaStore((s) => s.snapshot);
  const thumbnailUrl = useMediaStore((s) => s.thumbnailUrl);

  const { title, artist, isPlaying } = snapshot;

  switch (collapsedMode) {
    case "charging_connected":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse">
              {/* For battery keep the Battery icon */}
              <BatteryCharging size={13} className="text-emerald-400" />
            </div>
            <span className="text-[12px] font-semibold text-white">
              Charging <span className="tabular-nums">92%</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] font-mono tabular-nums text-emerald-300/90">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>67W Fast</span>
          </div>
        </div>
      );

    case "charging_disconnected":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/10 text-white/70 flex items-center justify-center">
              {/* For battery keep the Battery icon */}
              <BatteryMedium size={13} className="text-white/80" />
            </div>
            <span className="text-[12px] font-semibold text-white">Power Disconnected</span>
          </div>
          <span className="text-[10.5px] font-mono tabular-nums text-white/50">92% Battery</span>
        </div>
      );

    case "wifi_connected":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Wifi size={12} strokeWidth={2.4} />
            </div>
            <span className="text-[12px] font-semibold text-white">Wi-Fi Connected</span>
          </div>
          <span className="text-[11px] font-medium text-blue-300 truncate max-w-[120px]">
            5G-Studio-Pro
          </span>
        </div>
      );

    case "wifi_disconnected":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
              <WifiOff size={12} strokeWidth={2.4} />
            </div>
            <span className="text-[12px] font-semibold text-white">Wi-Fi Disconnected</span>
          </div>
          <span className="text-[10.5px] font-mono text-red-300/80">Offline</span>
        </div>
      );

    case "bluetooth_connected":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bluetooth size={12} strokeWidth={2.4} />
            </div>
            <span className="text-[12px] font-semibold text-white">AirPods Max</span>
          </div>
          <span className="text-[10.5px] font-mono text-emerald-300">Connected</span>
        </div>
      );

    case "bluetooth_disconnected":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/10 text-white/50 flex items-center justify-center">
              <BluetoothOff size={12} strokeWidth={2.4} />
            </div>
            <span className="text-[12px] font-semibold text-white">Bluetooth Off</span>
          </div>
          <span className="text-[10.5px] font-mono text-white/40">No Devices</span>
        </div>
      );

    case "airplane_on":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Plane size={12} className="-rotate-45" />
            </div>
            <span className="text-[12px] font-semibold text-white">Airplane Mode</span>
          </div>
          <span className="text-[10.5px] font-mono text-amber-300">Radios Off</span>
        </div>
      );

    case "airplane_off":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Radio size={12} />
            </div>
            <span className="text-[12px] font-semibold text-white">Airplane Mode Off</span>
          </div>
          <span className="text-[10.5px] font-mono text-blue-300">Restoring...</span>
        </div>
      );

    case "low_power":
      return (
        <div className="flex items-center justify-between w-full px-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              {/* For battery keep the Battery icon */}
              <BatteryLow size={13} className="text-amber-400" />
            </div>
            <span className="text-[12px] font-semibold text-white">Low Power Mode</span>
          </div>
          <span className="text-[10.5px] font-mono text-amber-300">Active</span>
        </div>
      );

    case "music":
    default:
      return (
        <div className="flex items-center justify-between w-full px-2.5 gap-3">
          {/* Left: Thumbnail & Song */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-white/10 flex items-center justify-center">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
                />
              ) : (
                <Music2 size={12} className="text-white/60" />
              )}
            </div>
            <div className="min-w-0 leading-tight">
              <span className="text-[12px] font-semibold text-white truncate block [text-wrap:balance]">
                {title || "Starboy"}
              </span>
              <span className="text-[10px] text-white/50 truncate block [text-wrap:pretty]">
                {artist || "The Weeknd"}
              </span>
            </div>
          </div>

          {/* Right: Sound Wave Equalizer Bars */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isPlaying ? (
              <div className="flex items-end gap-[2px] h-3" aria-hidden="true">
                <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-[pulse_0.5s_infinite]" />
                <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-[pulse_0.7s_infinite_0.1s]" />
                <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-[pulse_0.6s_infinite_0.2s]" />
              </div>
            ) : (
              <span className="text-[10px] font-mono text-white/40">Paused</span>
            )}
            <ChevronRight
              size={13}
              className="text-white/30 group-hover:text-white/80 group-hover:translate-x-0.5 transition-[color,transform] duration-150"
            />
          </div>
        </div>
      );
  }
}

export function IslandCollapsed() {
  const expand = useIslandStore((s) => s.expand);
  const collapsedMode = useIslandStore((s) => s.collapsedMode);

  return (
    <button
      type="button"
      onClick={expand}
      title="Click to expand Island HUD"
      className={`group relative h-[42px] ${getPillWidth(
        collapsedMode
      )} rounded-full bg-black/92 backdrop-blur-2xl
                 border border-white/15
                 shadow-[0_12px_36px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)_inset]
                 hover:scale-[1.02] active:scale-[0.96]
                 transition-[width,transform,background-color,border-color,box-shadow] duration-300 ease-out flex items-center overflow-hidden cursor-pointer`}
    >
      {/* Subtle glowing underlight on active states */}
      {collapsedMode === "charging_connected" && (
        <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none rounded-full" />
      )}
      {collapsedMode === "wifi_connected" && (
        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none rounded-full" />
      )}
      {collapsedMode === "airplane_on" && (
        <div className="absolute inset-0 bg-amber-500/10 pointer-events-none rounded-full" />
      )}

      <IslandCollapsedContent />
    </button>
  );
}
