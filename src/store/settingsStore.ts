import { create } from "zustand";

export interface SettingsState {
  liveActivitiesEnabled: boolean;
  bluetoothActivitiesEnabled: boolean;
  wifiActivitiesEnabled: boolean;
  volumeActivitiesEnabled: boolean;
  chargingActivitiesEnabled: boolean;
  batteryLowActivitiesEnabled: boolean;

  setLiveActivitiesEnabled: (enabled: boolean) => void;
  setBluetoothActivitiesEnabled: (enabled: boolean) => void;
  setWifiActivitiesEnabled: (enabled: boolean) => void;
  setVolumeActivitiesEnabled: (enabled: boolean) => void;
  setChargingActivitiesEnabled: (enabled: boolean) => void;
  setBatteryLowActivitiesEnabled: (enabled: boolean) => void;
}

const STORAGE_KEY = "testnotch_settings_v1";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    liveActivitiesEnabled: true,
    bluetoothActivitiesEnabled: true,
    wifiActivitiesEnabled: true,
    volumeActivitiesEnabled: true,
    chargingActivitiesEnabled: true,
    batteryLowActivitiesEnabled: true,
  };
}

function saveSettings(data: Partial<SettingsState>) {
  try {
    const current = loadSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...data }));
  } catch {}
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initial = loadSettings();

  return {
    liveActivitiesEnabled: initial.liveActivitiesEnabled ?? true,
    bluetoothActivitiesEnabled: initial.bluetoothActivitiesEnabled ?? true,
    wifiActivitiesEnabled: initial.wifiActivitiesEnabled ?? true,
    volumeActivitiesEnabled: initial.volumeActivitiesEnabled ?? true,
    chargingActivitiesEnabled: initial.chargingActivitiesEnabled ?? true,
    batteryLowActivitiesEnabled: initial.batteryLowActivitiesEnabled ?? true,

    setLiveActivitiesEnabled: (val) => {
      saveSettings({ liveActivitiesEnabled: val });
      set({ liveActivitiesEnabled: val });
    },
    setBluetoothActivitiesEnabled: (val) => {
      saveSettings({ bluetoothActivitiesEnabled: val });
      set({ bluetoothActivitiesEnabled: val });
    },
    setWifiActivitiesEnabled: (val) => {
      saveSettings({ wifiActivitiesEnabled: val });
      set({ wifiActivitiesEnabled: val });
    },
    setVolumeActivitiesEnabled: (val) => {
      saveSettings({ volumeActivitiesEnabled: val });
      set({ volumeActivitiesEnabled: val });
    },
    setChargingActivitiesEnabled: (val) => {
      saveSettings({ chargingActivitiesEnabled: val });
      set({ chargingActivitiesEnabled: val });
    },
    setBatteryLowActivitiesEnabled: (val) => {
      saveSettings({ batteryLowActivitiesEnabled: val });
      set({ batteryLowActivitiesEnabled: val });
    },
  };
});
