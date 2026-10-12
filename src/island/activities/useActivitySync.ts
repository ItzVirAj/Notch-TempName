import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useActivityStore, type ActivityDeviceType } from "../../store/activityStore";

interface VolumeEventPayload {
  volume: number;
  muted: boolean;
}

interface PowerEventPayload {
  onAc: boolean;
  percent: number;
  charging: boolean;
}

interface WifiEventPayload {
  connected: boolean;
  ssid: string | null;
}

interface BluetoothEventPayload {
  name: string;
  connected: boolean;
  deviceType?: ActivityDeviceType;
}

export function useActivitySync() {
  const pushActivity = useActivityStore((s) => s.pushActivity);
  const lastOnAcRef = useRef<boolean | null>(null);

  useEffect(() => {
    let unlistenVolume: UnlistenFn | null = null;
    let unlistenPower: UnlistenFn | null = null;
    let unlistenWifi: UnlistenFn | null = null;
    let unlistenBt: UnlistenFn | null = null;
    let isDisposed = false;

    // 1. Volume Change Listener
    listen<VolumeEventPayload>("volume://change", (event) => {
      const { volume, muted } = event.payload;
      const pct = Math.round(volume * 100);
      pushActivity({
        id: "master-volume",
        kind: "volume",
        title: "Volume",
        subtitle: muted ? "Muted" : `${pct}%`,
        value: pct,
        state: "level",
        deviceType: "generic",
      });
    }).then((unlisten) => {
      if (isDisposed) unlisten();
      else unlistenVolume = unlisten;
    });

    // 2. Power State Listener
    listen<PowerEventPayload>("power://state", (event) => {
      const { onAc, percent, charging } = event.payload;
      const prevOnAc = lastOnAcRef.current;
      lastOnAcRef.current = onAc;

      // AC power source transition
      if (prevOnAc !== null && prevOnAc !== onAc) {
        if (onAc) {
          pushActivity({
            id: "power-charger",
            kind: "charging",
            title: "Charger Connected",
            subtitle: `${percent}%`,
            value: percent,
            state: "charging",
            deviceType: "generic",
          });
        } else {
          pushActivity({
            id: "power-charger",
            kind: "charging",
            title: "Charger Disconnected",
            subtitle: `${percent}%`,
            value: percent,
            state: "unplugged",
            deviceType: "generic",
          });
        }
      }

      // Low Battery Threshold Alert (discharging and <= 20%)
      if (!onAc && percent <= 20) {
        pushActivity({
          id: `power-low-${percent <= 10 ? "critical" : "warning"}`,
          kind: "battery-low",
          title: percent <= 10 ? "Battery Critical" : "Low Battery",
          subtitle: `${percent}% remaining`,
          value: percent,
          state: "low",
          deviceType: "generic",
        });
      }

      // Fully Charged Alert
      if (onAc && percent >= 100 && charging) {
        pushActivity({
          id: "power-full",
          kind: "charging",
          title: "Fully Charged",
          subtitle: "100%",
          value: 100,
          state: "charging",
          deviceType: "generic",
        });
      }
    }).then((unlisten) => {
      if (isDisposed) unlisten();
      else unlistenPower = unlisten;
    });

    // 3. Wi-Fi Connectivity Listener
    listen<WifiEventPayload>("wifi://state", (event) => {
      const { connected, ssid } = event.payload;
      if (connected) {
        pushActivity({
          id: "wifi-status",
          kind: "wifi",
          title: ssid || "Wi-Fi",
          subtitle: "Connected",
          state: "connected",
          deviceType: "generic",
        });
      } else {
        pushActivity({
          id: "wifi-status",
          kind: "wifi",
          title: "Wi-Fi",
          subtitle: "Disconnected",
          state: "disconnected",
          deviceType: "generic",
        });
      }
    }).then((unlisten) => {
      if (isDisposed) unlisten();
      else unlistenWifi = unlisten;
    });

    // 4. Bluetooth Connection Listener
    listen<BluetoothEventPayload>("bluetooth://state", (event) => {
      const { name, connected, deviceType } = event.payload;
      pushActivity({
        id: `bt-${name}`,
        kind: "bluetooth",
        title: name,
        subtitle: connected ? "Connected" : "Disconnected",
        state: connected ? "connected" : "disconnected",
        deviceType: deviceType || "generic",
      });
    }).then((unlisten) => {
      if (isDisposed) unlisten();
      else unlistenBt = unlisten;
    });

    return () => {
      isDisposed = true;
      if (unlistenVolume) unlistenVolume();
      if (unlistenPower) unlistenPower();
      if (unlistenWifi) unlistenWifi();
      if (unlistenBt) unlistenBt();
    };
  }, [pushActivity]);
}
