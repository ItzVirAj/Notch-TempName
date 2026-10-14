import type { ReactNode } from "react";

/**
 * One consistent icon family: 24px grid, 1.8 stroke, round caps and joins.
 * Filled glyphs (play, pause) are the only exceptions.
 */
interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 16,
  className,
  filled = false,
  children,
}: IconProps & { filled?: boolean; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </Svg>
);

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6z" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <rect x="6" y="4" width="4.2" height="16" rx="1.4" />
    <rect x="13.8" y="4" width="4.2" height="16" rx="1.4" />
  </Svg>
);

export const PrevIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <rect x="4" y="5" width="2.6" height="14" rx="1.2" />
    <path d="M20 5.6v12.8a1 1 0 0 1-1.6.8l-9.2-6.4a1 1 0 0 1 0-1.6l9.2-6.4a1 1 0 0 1 1.6.8z" />
  </Svg>
);

export const NextIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <rect x="17.4" y="5" width="2.6" height="14" rx="1.2" />
    <path d="M4 5.6v12.8a1 1 0 0 0 1.6.8l9.2-6.4a1 1 0 0 0 0-1.6L5.6 4.8A1 1 0 0 0 4 5.6z" />
  </Svg>
);

export const WifiIcon = ({ off, ...p }: IconProps & { off?: boolean }) => (
  <Svg {...p}>
    <path d="M2 9a15 15 0 0 1 20 0" />
    <path d="M5.5 12.6a10 10 0 0 1 13 0" />
    <path d="M9 16.2a5 5 0 0 1 6 0" />
    <circle cx="12" cy="19.6" r="0.6" fill="currentColor" />
    {off && <path d="M4 3l16 18" />}
  </Svg>
);

export const BluetoothIcon = ({ off, ...p }: IconProps & { off?: boolean }) => (
  <Svg {...p}>
    <path d="M6.5 7.5l11 9-5.5 5V2l5.5 5-11 9" />
    {off && <path d="M3 3l18 18" />}
  </Svg>
);

export const LeafIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" />
    <path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12" />
  </Svg>
);

export const BoltIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <path d="M13.2 2.4a.6.6 0 0 0-1.1-.3L4.6 13.2a.8.8 0 0 0 .7 1.3H10l-1 7.1a.6.6 0 0 0 1.1.4l7.4-11.2a.8.8 0 0 0-.7-1.3H12.2z" />
  </Svg>
);

export const BatteryIcon = ({ level = 1, ...p }: IconProps & { level?: number }) => {
  const w = Math.max(0, Math.min(1, level)) * 12;
  return (
    <Svg {...p}>
      <rect x="2" y="7" width="17" height="10" rx="2.5" />
      <path d="M22 11v2" />
      <rect x="4.5" y="9.5" width={w} height="5" rx="1" fill="currentColor" stroke="none" />
    </Svg>
  );
};

export const SpeakerIcon = ({ level = 1, muted, ...p }: IconProps & { level?: number; muted?: boolean }) => (
  <Svg {...p}>
    <path d="M11 5L6 9H3v6h3l5 4z" />
    {muted ? (
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    ) : (
      <>
        {level > 0 && <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />}
        {level > 0.5 && <path d="M18.4 6.6a7.5 7.5 0 0 1 0 10.8" />}
      </>
    )}
  </Svg>
);

export const PinIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M12 17v5" />
    <path
      d="M5 17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.4-.7a2 2 0 0 1-1.1-1.8V6h1a1.5 1.5 0 0 0 0-3H8.6a1.5 1.5 0 0 0 0 3h1v4.9a2 2 0 0 1-1.1 1.8l-1.4.7A2 2 0 0 0 5 15.2z"
      fill={filled ? "currentColor" : "none"}
    />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const HeadphonesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </Svg>
);

export const SpeakerBoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="2.5" width="14" height="19" rx="3" />
    <circle cx="12" cy="14.5" r="3.5" />
    <circle cx="12" cy="7" r="0.6" fill="currentColor" />
  </Svg>
);

export const KeyboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7.5 15h9" />
  </Svg>
);

export const MouseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="2.5" width="12" height="19" rx="6" />
    <path d="M12 7v4" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="2" width="12" height="20" rx="3" />
    <path d="M12 18h.01" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
