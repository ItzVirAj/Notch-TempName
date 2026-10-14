# Animation Improvement Plans

Prioritized motion roadmap for `testnotch` based on Emil Kowalski's animation philosophy.

| Plan | Title | Severity | Status |
| ---- | ----- | -------- | ------ |
| [001](001-hardware-accelerated-equalizer-and-motion-springs.md) | Hardware-Accelerated Equalizer & Apple Motion Springs | HIGH | DONE |

## Execution Order

1. **Plan 001** (Immediate): Offloads continuous equalizer animations from main thread layout calculations to GPU compositor transforms (`scaleY`), elevates tab crossfades to Emil's `--ease-out: [0.23, 1, 0.32, 1]` curve, and standardizes button press scale to tactile `0.95`.
