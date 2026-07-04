# UI Screen Map — La Catedral

Reference for giving precise UI instructions. File: **`docs/UI-SCREEN-MAP.md`**.

---

## Layout (desktop / TV)

```
┌─────────────────────────────────────────────────────────────┐
│  [sidebar-panel]          │  [prayer-main-view]           │
│                           │                               │
│  sidebar-clock            │  prayer-timing-bar            │
│  sidebar-ticker-panel     │  prayer-text-scroll           │
│  sidebar-footer           │  transport-bar                │
└─────────────────────────────────────────────────────────────┘
     [background-layers + atmosphere — full viewport behind]
```

---

## Left column — `sidebar-panel`

| Element ID (use in instructions) | What it is |
|----------------------------------|------------|
| **sidebar-clock** | Block with app icon, **La Catedral**, clock (HH:mm), date, current hour, next hour |
| **sidebar-ticker-panel** | Prayer title strip (split-flap / departure-board style) |
| **sidebar-ticker-header** | Current group + next group + “Siguiente · X min” |
| **ticker-viewport** | Window where title rows scroll vertically |
| **ticker-slot** | Gold horizontal band marking the “active” row |
| **ticker-row** | One prayer title line in the sidebar strip |
| **sidebar-footer** | Bottom controls |
| **sidebar-footer-btn — Letra** | Font size: pequeña / media / grande (key **F**) |
| **sidebar-footer-btn — Recargar Capilla** | Clears storage and reloads |

Mobile: sidebar hidden until **mobile-header → Menú (☰)** opens it.

---

## Main column — `prayer-main-view`

| Element ID | What it is |
|------------|------------|
| **prayer-timing-bar** | Top meta + progress dots for current liturgical **group** |
| **prayer-timing-meta** | Left: current title · subtitle. Right: “Siguiente: … · N min” |
| **prayer-progress-dots** | Dotted progress: one segment per prayer in the group; width ∝ text length |
| **prayer-text-scroll** | Main reading area (vertical ticker of psalm text) |
| **AutoPager header** | Subtitle (small caps) + title (e.g. Salmo 141) — hidden on mobile |
| **ticker-viewport--prayer** | Prayer text viewport with gold **ticker-slot** band |
| **prayer-verse** | Each line / paragraph of the psalm |
| **liturgy-char** | Per-character highlight as reading progresses |
| **sacred-frame** | Thin decorative border around text |
| **fragment-nav — prev / next** | ‹ › buttons (also ← → keys, swipe) |

---

## Bottom — `transport-bar`

| Element ID | What it is |
|------------|------------|
| **transport-play** | Play / pause (Space) |
| **transport-zen** | Modo Zen — hides chrome (Z) |
| **transport-mute** | Mute all audio (M) |
| **transport-ambient** | **Ambiente** — toggles ambient drone (A). Off by default. |
| **transport-voz** | Voice recorder overlay (V) |
| **transport-scrubber** | Audio progress for spoken prayer (when playing) |

---

## Ambient audio — `ambient-drone`

| Piece | Role |
|-------|------|
| **Cosmic Resonator** | Web Audio synth (low organ-like drone) |
| **transport-ambient** | User toggle; persisted as `localStorage` key `cathedral-ambient` |
| Default | **Off** — drone only when Ambiente is active and not muted |

---

## Full-screen atmosphere (behind UI)

| Layer | Name |
|-------|------|
| **background-layers** | Hour-themed sacred art, parallax |
| **global-vignette** | Dark edge fade |
| **incense-trail** | Particle motion |
| **light-shafts** | God-rays |
| **dust-motes** | Floating dust |
| **celestial-clockwork** | Slow rotating sacred geometry |

---

## Overlays

| Element | When |
|---------|------|
| **update-banner** | New deploy available → “Actualizar” |
| **recorder-modal** | Recording voice (V) |
| **mobile-header** | Phone top bar: menu + La Catedral + hour |
| **focus-mode** | Zen: hides sidebar, timing bar, transport |

---

## Liturgical data (for instructions)

| Concept | Code / behaviour |
|---------|------------------|
| **Hour** | One of 7: Maitines, Laudes, Tercia, Sexta, Nona, Vísperas, Completas |
| **Group** | Hour block or Ángelus (6:00, 12:00, 18:00) |
| **Slot / prayer** | One titled fragment (e.g. Salmo 141) — ~73 per 24 h cycle |
| **sidebar strip** | All day titles, 24 h loop |
| **main text** | Current slot text, scrolls with slot progress |

---

## Language

Default UI and prayers: **castellano (es)**.

---

## Version

Shown in sidebar footer: `v{VERSION}` (e.g. v1.3.8).
