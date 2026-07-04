# Sacred Modules — Integration Guide

Extracted from **Rosario Cards v2** (`cloud-rosary-v2` branch) and wired into Cathedral.

| Module | File | Watermark |
|--------|------|-----------|
| Cosmic Resonator | `cosmic-resonator.ts` | devtrivi + zengasoft |
| Procedural Rose | `procedural-rose.tsx` | devtrivi + zengasoft |
| React Hook | `useCosmicResonator.ts` | zengasoft |

---

## What's Wired

### Ambient Gothic Organ
- Plays when you enter the chapel (`handleEnter`)
- Sustains during prayer audio playback
- Stops on pause / audio end
- Uses cosmic planetary phases to modulate filter cutoff and LFO breath

### Sacred Drawing
- A subtle cross SVG in the top-right of the prayer text card
- Draws itself progressively based on `isPlaying` state

---

## Manual Usage (if you want more)

```tsx
import { useCosmicResonator } from './sacred/useCosmicResonator';
import { SacredDrawing, RoseDrawing } from './sacred/procedural-rose';

const { init, start, stop, setProgress, setWarmth, playBell } = useCosmicResonator();

// Init on user click (required for AudioContext)
init(!isMuted);

// Start ambient drone
start();

// Modulate as prayer deepens
setProgress(0.5);
setWarmth(0.7);

// One-shot bell
playBell();

// Visual rose
<RoseDrawing progress={0.6} warmthProfile={[0.2,0.5,0.9]} seed={Date.now()} size={150} />
<SacredDrawing symbolKey="flame" progress={0.8} size={120} />
```

---

## Architecture

- **No external dependencies** — pure Web Audio API + React.
- `cosmic-resonator.ts` uses `requestAnimationFrame` for smooth filter modulation.
- `procedural-rose.tsx` uses SVG `stroke-dashoffset` trick for progressive drawing.

## License

Sacred Performance License v1.2 — Copyright (c) 2026 gatrivi. All Rights Reserved.
