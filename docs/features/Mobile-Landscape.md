# Mobile landscape (hard constraint)

**If it does not work on a phone in landscape, the app is useless.**

Target device reference: **Nubia Focus 5G** (and similar ~6" phones). Landscape ≈ wide × short (~800×360 CSS px).

## Detection (do not break this)

```ts
// src/App.tsx — isLandscapeMobile
'(orientation: landscape) and (max-height: 500px)'
```

Wrong (was broken): `max-width: 767px` — in landscape, width is often **>767**, so rules never applied.

CSS mirror: `@media (orientation: landscape) and (max-height: 500px)` + class `.landscape-mobile`.

## Calm UI rules (nurturing, not seizure)

| Do | Don't |
|----|--------|
| Stable accent gold `#d4af37` | Recolor accent per liturgical hour |
| Steady prayer text color | Per-character gold/muted thrash |
| Pixel-quantized scroll | Subpixel crawl every tick |
| Slow progress transitions (~1s) | 0.1–0.2s color/width snaps |
| Hide dust/incense/celestial on landscape | Full atmosphere stack on tiny LCDs |

## Layout goals in landscape

1. Compact header (~2.5rem).
2. Timing bar one line + thin progress.
3. Prayer text gets most of the short height.
4. Controles stay a small floating pill.
5. Sidebar overlays ~28vw when open; prayer shifts right.

## Files

- `src/App.tsx` — media query, no hour accent thrash, lighter atmosphere
- `src/components/AutoPager.tsx` — no liturgy-char recolor
- `src/index.css` — landscape block
- `src/components/PrayerTimingBar.tsx` — slower fill

Version when restored: **v1.4.0**.
