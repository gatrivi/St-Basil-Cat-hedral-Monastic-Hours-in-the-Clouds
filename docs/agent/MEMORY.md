# Cathedral — Developer Handover & Context (v1.4.5)

## 1. Project Overview
Monastic prayer app (Liturgy of the Hours). Day-correct Spanish LoH text, TTS/manual audio, calm reading UI. **Phone landscape is a hard requirement** — see `docs/features/Mobile-Landscape.md`.

## 2. Technical Architecture

### Prayer text
1. **Live office:** `src/services/liturgyOffice.ts`
2. **Playlist:** `src/lib/liturgicalDay.ts`
3. **Fallback:** `src/lib/liturgicalFragments.ts`

### Audio
1. Manual recordings (Firebase)
2. Piper TTS
3. Web Speech: disabled

### Calm UI (v1.4.5 — do not regress)
- Main: prayer text + bg + one `.read-vignette`
- Chrome: ~36px — menu | hour·time | play
- Sidebar: overlay drawer only (4 nearby titles). No permanent column / ticker / clock
- **Update banner DISABLED** (`useUpdateCheck` no-ops) — trapped users before
- Landscape: `(orientation: landscape) and (max-height: 500px)`

### Keys
`[V]` recorder · `[Space]` play · `[←→]` slots · `[M]` mute · `[A]` ambient · `[Z]` zen · `[F]` font

## 3. Pending
- [ ] Offline MP3s
- [ ] Background srcset
- [ ] Safe re-enable of update check (SW + cache-bust)

---
*Resume: `src/App.tsx` + this file.*
