# Project: testnotch (working name)
A lightweight Windows 11 app that renders an animated notch / dynamic island at the top-center of the screen. Later it will hold music controls, a to-do list, a clipboard manager, and a voice AI assistant. For now we are building the notch shell.

## Stack
Tauri 2 (Rust), React + TypeScript + Vite, Tailwind CSS, Motion (`motion/react`), Zustand.

## Principles
- Performance first. At idle the app does zero work: no requestAnimationFrame loops, no infinite CSS animations, no polling. Use events, not timers.
- Animation must feel fluid: use spring transitions, animate only `transform` and `opacity` (plus the SVG path of the notch). Avoid animating width/height of large layouts. Avoid `backdrop-filter`.
- The native window stays a fixed size. Animate the DOM inside it, never resize the OS window per frame.
- Keep the Rust side thin: one small module per Windows capability (window, tray, hotkeys, media, clipboard, mic), exposed to the UI through Tauri commands and events.
- Lazy-load heavy UI (settings, clipboard panel) and create secondary windows only when opened.
- The island has an explicit state machine (hidden, idle, expanded, etc.) in a Zustand store. UI reads state, it does not invent it.

## Workflow rules
- Work in small vertical slices. Finish and run one slice before starting the next.
- Do not add new dependencies without asking me.
- After each slice, make sure `npm run tauri dev` still runs with no errors or warnings, then commit.
- Explain any Windows-specific API choices briefly before using them.
- Keep code readable and commented where the Windows behavior is non-obvious.
