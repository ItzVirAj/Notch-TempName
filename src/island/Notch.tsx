import {
  DEFAULT_BOTTOM_RADIUS,
  DEFAULT_FLARE_RADIUS,
  DEFAULT_NOTCH_HEIGHT,
  DEFAULT_NOTCH_WIDTH,
  ISLAND_TOP_GAP,
  type NotchVariant,
} from "./constants";
import { buildNotchPath } from "./notchPath";

// Switch between "notch" and "island" variants
export const NOTCH_VARIANT: NotchVariant = "notch";

interface NotchProps {
  variant?: NotchVariant;
  width?: number;
  height?: number;
  bottomRadius?: number;
  flareRadius?: number;
  topGap?: number;
}

export default function Notch({
  variant = NOTCH_VARIANT,
  width = DEFAULT_NOTCH_WIDTH,
  height = DEFAULT_NOTCH_HEIGHT,
  bottomRadius = DEFAULT_BOTTOM_RADIUS,
  flareRadius = DEFAULT_FLARE_RADIUS,
  topGap = ISLAND_TOP_GAP,
}: NotchProps) {
  const isNotch = variant === "notch";
  const totalWidth = isNotch ? width + 2 * flareRadius : width;
  const totalHeight = isNotch ? height : height + topGap;

  const d = buildNotchPath({
    width,
    height,
    bottomRadius,
    flareRadius,
    variant,
    topGap,
  });

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="absolute top-0 left-1/2 -translate-x-1/2 overflow-visible"
      shapeRendering="geometricPrecision"
    >
      <path d={d} fill="#000000" />
    </svg>
  );
}
