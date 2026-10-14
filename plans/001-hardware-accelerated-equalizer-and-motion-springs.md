# 001 — Hardware-Accelerated Equalizer & Apple Motion Springs

- **Status**: DONE
- **Commit**: facdcce
- **Severity**: HIGH
- **Category**: Performance, Physicality & Easing
- **Estimated scope**: 1 file (`src/island/media/PlayerExpanded.tsx`)

## Problem

1. **Non-GPU Keyframe Layout Thrashing** in `src/island/media/PlayerExpanded.tsx:32-51`:
   The audio equalizer animates `height` directly inside `@keyframes eq-bounce-1`, `eq-bounce-2`, `eq-bounce-3`, `eq-bounce-4`:
```css
/* current */
@keyframes eq-bounce-1 {
  0%, 100% { height: 25%; }
  50% { height: 95%; }
}
```
   Per Emil Kowalski's motion audit rule 5 (Performance): Animating `height` triggers continuous layout recalculation and paint cycles on the main thread for every animation frame. It must be refactored to `transform: scaleY(...)` with `transform-origin: bottom`, which runs purely on the GPU compositor.

2. **Weak Default Easings on Tab Crossfades** in `src/island/media/PlayerExpanded.tsx`:
   Tab navigation uses `ease: "easeOut"` with basic y-displacement, which feels floaty and generic:
```tsx
/* current */
transition={{ duration: 0.14, ease: "easeOut" }}
```
   Per AUDIT.md rule 2 (Easing & duration) and rule 3 (Physicality & origin): Target Apple-grade strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)` with subtle scale `0.98 -> 1` and fast 160ms duration so switching tabs feels authoritative and snappy.

3. **Overly Aggressive Tap Scale**:
   Several buttons use `whileTap={{ scale: 0.88 }}`, which creates an exaggerated rubbery collapse. Emil's standard for tactile buttons is `scale(0.95–0.97)` with `160ms ease-out`.

## Target

1. Equalizer bars styled with `h-full origin-bottom` and keyframes animating `transform: scaleY(...)`:
```css
/* target */
@keyframes pe-eq-1 {
  0%, 100% { transform: scaleY(0.25); }
  50% { transform: scaleY(0.95); }
}
@keyframes pe-eq-2 {
  0%, 100% { transform: scaleY(0.40); }
  50% { transform: scaleY(1.00); }
}
@keyframes pe-eq-3 {
  0%, 100% { transform: scaleY(0.20); }
  50% { transform: scaleY(0.80); }
}
@keyframes pe-eq-4 {
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(0.90); }
}
.pe-eq-bar {
  transform-origin: bottom;
  will-change: transform;
}
```

2. Tab transition curves using Emil's strong ease-out:
```tsx
/* target */
initial={{ opacity: 0, scale: 0.98, y: 3 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.98, y: -3 }}
transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
```

3. Tactile button press feedback aligned to standard `whileTap={{ scale: 0.95 }}` with spring damping 25.

## Repo conventions to follow

- Uses `motion/react` library.
- Spring configurations matching `src/island/constants.ts`.
- Scoped CSS in `PlayerExpanded.tsx` for keyframes.

## Steps

1. In `src/island/media/PlayerExpanded.tsx`, update CSS keyframes from `height` to `transform: scaleY(...)` with `transform-origin: bottom`.
2. Update the equalizer bar spans to use `h-full origin-bottom` and `.pe-eq-bar` classes.
3. Update `AnimatePresence` children transition in tabs to `[0.23, 1, 0.32, 1]` with `scale: 0.98 -> 1`.
4. Refine `whileTap={{ scale: ... }}` on transport buttons and tabs to `scale: 0.95`.

## Boundaries

- Do not alter Tauri backend invokes or media store bindings.
- Keep 667x294 canvas size and 32px bottom border radius intact.
- Motion properties and CSS keyframes only.

## Verification

- **Mechanical**: `npx tsc --noEmit` exits with code 0.
- **Feel check**:
  - Play music: Equalizer bars oscillate fluidly without causing DevTools Layout Shifts.
  - Switch tabs: Transitions snap instantly with crisp `[0.23, 1, 0.32, 1]` curve and subtle tactile scale.
  - Click transport buttons: Press feedback is firm and subtle (`scale: 0.95`), not spongy.
- **Done when**: No layout recalculation occurs during equalizer animation, and tab transitions feel snappy and instant.
