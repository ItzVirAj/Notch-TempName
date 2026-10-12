import { invoke } from "@tauri-apps/api/core";

/**
 * Sends logical hit region dimensions (width & height) to the native Tauri host.
 * The Rust backend converts logical pixels to physical coordinates using monitor scale factor
 * and calls Win32 SetWindowRgn.
 *
 * Wrapped in try/catch to ensure errors log warnings rather than crashing animation loops.
 */
export async function setNativeHitRegion(width: number, height: number): Promise<void> {
  if (import.meta.env.DEV) {
    console.warn(`[hitRegion.ts] invoking set_hit_region: ${width}x${height}`);
  }
  try {
    await invoke("set_hit_region", { width, height });
  } catch (error) {
    console.warn("Failed to set native hit region:", error);
  }
}
