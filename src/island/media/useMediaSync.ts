import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useMediaStore, type MediaSnapshot } from "../../store/mediaStore";

/**
 * Custom hook that synchronizes Windows System Media Transport Controls (GSMTC)
 * state with the Zustand mediaStore.
 *
 * - On mount: fetches current snapshot via media_get_state and subscribes to "media://state".
 * - Fetches thumbnail only when thumbnailVersion changes.
 * - Downscales cover art to 128x128 via createImageBitmap + Canvas to minimize memory footprint.
 * - Always revokes previous Blob Object URLs on updates and unmount.
 */
export function useMediaSync(): void {
  const setSnapshot = useMediaStore((s) => s.setSnapshot);
  const setThumbnailUrl = useMediaStore((s) => s.setThumbnailUrl);
  const currentThumbVerRef = useRef<number>(-1);
  const activeUrlRef = useRef<string | null>(null);

  // Helper to revoke active object URL safely
  const revokeActiveUrl = () => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
      setThumbnailUrl(null);
    }
  };

  // Helper to fetch and downscale thumbnail
  const fetchThumbnail = async (version: number) => {
    if (version === currentThumbVerRef.current) return;
    currentThumbVerRef.current = version;

    try {
      const data = await invoke<ArrayBuffer | number[] | Uint8Array>("media_get_thumbnail");
      let blob: Blob;

      if (data instanceof ArrayBuffer) {
        if (data.byteLength === 0) {
          revokeActiveUrl();
          return;
        }
        blob = new Blob([data]);
      } else if (Array.isArray(data)) {
        if (data.length === 0) {
          revokeActiveUrl();
          return;
        }
        blob = new Blob([new Uint8Array(data) as unknown as BlobPart]);
      } else if (data instanceof Uint8Array) {
        if (data.byteLength === 0) {
          revokeActiveUrl();
          return;
        }
        blob = new Blob([data as unknown as BlobPart]);
      } else {
        revokeActiveUrl();
        return;
      }
      // Use browser createImageBitmap with native resize if supported
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: 128,
        resizeHeight: 128,
        resizeQuality: "medium",
      });

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        bitmap.close();
        revokeActiveUrl();
        return;
      }

      ctx.drawImage(bitmap, 0, 0, 128, 128);
      bitmap.close();

      canvas.toBlob((resizedBlob) => {
        if (!resizedBlob) {
          revokeActiveUrl();
          return;
        }

        // Revoke prior URL before storing the new one
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current);
        }

        const newUrl = URL.createObjectURL(resizedBlob);
        activeUrlRef.current = newUrl;
        setThumbnailUrl(newUrl);
      }, "image/webp", 0.85);
    } catch {
      // Decode or IPC error: show fallback placeholder
      revokeActiveUrl();
    }
  };

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let isMounted = true;

    const handleSnapshot = (snap: MediaSnapshot) => {
      if (!isMounted) return;
      setSnapshot(snap);

      if (!snap.hasSession) {
        currentThumbVerRef.current = -1;
        revokeActiveUrl();
        return;
      }

      if (snap.thumbnailVersion !== currentThumbVerRef.current) {
        fetchThumbnail(snap.thumbnailVersion);
      }
    };

    // 1. Initial snapshot on mount so no state is missed
    invoke<MediaSnapshot>("media_get_state")
      .then((initialSnap) => {
        if (isMounted && initialSnap) {
          handleSnapshot(initialSnap);
        }
      })
      .catch(() => {});

    // 2. Subscribe to event-driven updates from Rust worker
    listen<MediaSnapshot>("media://state", (event) => {
      if (isMounted && event.payload) {
        handleSnapshot(event.payload);
      }
    }).then((unlistenFn) => {
      if (isMounted) {
        unlisten = unlistenFn;
      } else {
        unlistenFn();
      }
    });

    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, [setSnapshot, setThumbnailUrl]);
}
