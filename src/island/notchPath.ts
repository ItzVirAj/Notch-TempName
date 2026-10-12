import {
  DEFAULT_FLARE_RADIUS,
  IDLE_BOTTOM_RADIUS,
  IDLE_NOTCH_HEIGHT,
  IDLE_NOTCH_WIDTH,
  ISLAND_TOP_GAP,
  type NotchVariant,
} from "./constants";

export interface NotchPathParams {
  width?: number;
  height?: number;
  bottomRadius?: number;
  flareRadius?: number;
  variant?: NotchVariant;
  topGap?: number;
}

/**
 * Geometric Construction & Morph Stability:
 *
 * 1. Command Invariance for Motion Interpolation:
 *    Regardless of variant ('notch' vs 'island') or size parameters, this function
 *    ALWAYS emits the exact same sequence of 10 SVG path commands:
 *      [M, C, L, C, L, C, L, C, L, Z]
 *    This allows Motion / Framer Motion to morph between states and variants
 *    without topological tearing or mismatched control points.
 *
 * 2. Continuous Curvature Approximation:
 *    We use cubic Bézier curves (K_BEZIER = 4 * (sqrt(2) - 1) / 3 ≈ 0.55228)
 *    to approximate continuous squircle curvature with C1/tangent continuity
 *    at every transition between straight edges and curves.
 *
 * 3. Clamping for Spring Undershoot / Overshoot:
 *    Inputs are clamped so spring physics oscillations can never yield negative
 *    dimensions or radii exceeding available geometry.
 *
 * 4. 'notch' Variant (Screen-merged):
 *    - Extends 1px above y = 0 (y = -1) to prevent subpixel anti-aliasing seams at the top edge.
 *    - Left flare (C): concave curve from (0, -1) down to (flareRadius, flareRadius).
 *    - Left side (L): straight vertical line down to (flareRadius, height - bottomRadius).
 *    - Bottom-left corner (C): convex curve from (flareRadius, height - bottomRadius) to (flareRadius + bottomRadius, height).
 *    - Bottom edge (L): straight horizontal line to (totalWidth - flareRadius - bottomRadius, height).
 *    - Bottom-right corner (C): convex curve up to (totalWidth - flareRadius, height - bottomRadius).
 *    - Right side (L): straight vertical line up to (totalWidth - flareRadius, flareRadius).
 *    - Right flare (C): concave curve outward to (totalWidth, -1).
 *    - Top edge (L): straight horizontal line across to (0, -1).
 *
 * 5. 'island' Variant (Floating Pill):
 *    - Floats detached with `topGap` (default 6px) from the screen edge.
 *    - Fully rounded convex corners (top-left, bottom-left, bottom-right, top-right).
 *    - Symmetrically maps to the same 10-command sequence for seamless morphing.
 */
const K_BEZIER = 0.5522847498;

function f(n: number): string {
  // Round to 3 decimal places to keep SVG string compact and crisp
  return Number(n.toFixed(3)).toString();
}

export function buildNotchPath(params?: NotchPathParams): string {
  const rawWidth = params?.width ?? IDLE_NOTCH_WIDTH;
  const rawHeight = params?.height ?? IDLE_NOTCH_HEIGHT;
  const rawBottomR = params?.bottomRadius ?? IDLE_BOTTOM_RADIUS;
  const flareRadius = Math.max(0, params?.flareRadius ?? DEFAULT_FLARE_RADIUS);
  const variant = params?.variant ?? "notch";
  const topGap = Math.max(0, params?.topGap ?? ISLAND_TOP_GAP);

  // Clamp sizes to ensure spring undershoot never creates degenerate dimensions
  const width = Math.max(20, rawWidth);
  const height = Math.max(10, rawHeight);
  const bottomRadius = Math.max(0, Math.min(rawBottomR, width / 2, height / 2));

  if (variant === "notch") {
    const totalWidth = width + 2 * flareRadius;
    const yTop = -1; // 1px above y=0 to eliminate anti-aliasing hairline seam
    const yBottom = height;
    const xLeft = flareRadius;
    const xRight = flareRadius + width;

    // Ensure bottom radius does not collide with the flare radius vertically
    const maxBottomR = Math.max(0, height - flareRadius);
    const effectiveBottomR = Math.min(bottomRadius, maxBottomR, width / 2);

    // Left flare control points (concave: horizontal at yTop -> vertical at xLeft)
    const lfCp1x = K_BEZIER * flareRadius;
    const lfCp1y = yTop;
    const lfCp2x = xLeft;
    const lfCp2y = flareRadius - K_BEZIER * (flareRadius - yTop);

    // Bottom-left corner control points (convex: vertical -> horizontal)
    const blCp1x = xLeft;
    const blCp1y = yBottom - effectiveBottomR + K_BEZIER * effectiveBottomR;
    const blCp2x = xLeft + effectiveBottomR - K_BEZIER * effectiveBottomR;
    const blCp2y = yBottom;

    // Bottom-right corner control points (convex: horizontal -> vertical)
    const brCp1x = xRight - effectiveBottomR + K_BEZIER * effectiveBottomR;
    const brCp1y = yBottom;
    const brCp2x = xRight;
    const brCp2y = yBottom - effectiveBottomR + K_BEZIER * effectiveBottomR;

    // Right flare control points (concave: vertical at xRight -> horizontal at yTop)
    const rfCp1x = xRight;
    const rfCp1y = flareRadius - K_BEZIER * (flareRadius - yTop);
    const rfCp2x = totalWidth - K_BEZIER * flareRadius;
    const rfCp2y = yTop;

    return [
      `M 0 ${f(yTop)}`,
      `C ${f(lfCp1x)} ${f(lfCp1y)}, ${f(lfCp2x)} ${f(lfCp2y)}, ${f(xLeft)} ${f(flareRadius)}`,
      `L ${f(xLeft)} ${f(yBottom - effectiveBottomR)}`,
      `C ${f(blCp1x)} ${f(blCp1y)}, ${f(blCp2x)} ${f(blCp2y)}, ${f(xLeft + effectiveBottomR)} ${f(yBottom)}`,
      `L ${f(xRight - effectiveBottomR)} ${f(yBottom)}`,
      `C ${f(brCp1x)} ${f(brCp1y)}, ${f(brCp2x)} ${f(brCp2y)}, ${f(xRight)} ${f(yBottom - effectiveBottomR)}`,
      `L ${f(xRight)} ${f(flareRadius)}`,
      `C ${f(rfCp1x)} ${f(rfCp1y)}, ${f(rfCp2x)} ${f(rfCp2y)}, ${f(totalWidth)} ${f(yTop)}`,
      `L 0 ${f(yTop)}`,
      `Z`,
    ].join(" ");
  }

  // Island variant: floating pill with symmetric squircle corners
  const totalWidth = width;
  const yTop = topGap;
  const yBottom = topGap + height;
  const xLeft = 0;
  const xRight = totalWidth;
  const r = Math.min(bottomRadius, height / 2, width / 2);

  // Top-left corner control points (convex: horizontal -> vertical)
  const tlCp1x = xLeft + r - K_BEZIER * r;
  const tlCp1y = yTop;
  const tlCp2x = xLeft;
  const tlCp2y = yTop + r - K_BEZIER * r;

  // Bottom-left corner control points (convex: vertical -> horizontal)
  const blCp1x = xLeft;
  const blCp1y = yBottom - r + K_BEZIER * r;
  const blCp2x = xLeft + r - K_BEZIER * r;
  const blCp2y = yBottom;

  // Bottom-right corner control points (convex: horizontal -> vertical)
  const brCp1x = xRight - r + K_BEZIER * r;
  const brCp1y = yBottom;
  const brCp2x = xRight;
  const brCp2y = yBottom - r + K_BEZIER * r;

  // Top-right corner control points (convex: vertical -> horizontal)
  const trCp1x = xRight;
  const trCp1y = yTop + r - K_BEZIER * r;
  const trCp2x = xRight - r + K_BEZIER * r;
  const trCp2y = yTop;

  return [
    `M ${f(xLeft + r)} ${f(yTop)}`,
    `C ${f(tlCp1x)} ${f(tlCp1y)}, ${f(tlCp2x)} ${f(tlCp2y)}, ${f(xLeft)} ${f(yTop + r)}`,
    `L ${f(xLeft)} ${f(yBottom - r)}`,
    `C ${f(blCp1x)} ${f(blCp1y)}, ${f(blCp2x)} ${f(blCp2y)}, ${f(xLeft + r)} ${f(yBottom)}`,
    `L ${f(xRight - r)} ${f(yBottom)}`,
    `C ${f(brCp1x)} ${f(brCp1y)}, ${f(brCp2x)} ${f(brCp2y)}, ${f(xRight)} ${f(yBottom - r)}`,
    `L ${f(xRight)} ${f(yTop + r)}`,
    `C ${f(trCp1x)} ${f(trCp1y)}, ${f(trCp2x)} ${f(trCp2y)}, ${f(xRight - r)} ${f(yTop)}`,
    `L ${f(xLeft + r)} ${f(yTop)}`,
    `Z`,
  ].join(" ");
}
