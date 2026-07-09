# Scheduled Prayers - Booklet Assets (v1.3.9)

## Where the documents are
`public/booklets/` — offline reference only.

## What the app uses (simpler path)
**Live Spanish office** from [liturgiadelashoras.github.io](https://liturgiadelashoras.github.io/) (see `liturgiacalendario.txt`).

- Service: `src/services/liturgyOffice.ts`
- Playlist: `src/lib/liturgicalDay.ts` (`setOfficePlaylist`)
- Fallback: static snippets in `src/lib/liturgicalFragments.ts` if fetch fails

Prefers **feria** variant (`3/`) when a day has regional memorials.

## Why not the PDFs?
| Asset | Role | Complexity |
|-------|------|------------|
| Live site (HTML/day) | **Implemented** | Low — day-correct, 7 hours ready |
| `Diurnal_Salterio.pdf` | 4-week psalter | Medium — no calendar propers |
| 4× `29ed70_*.pdf` (vols I–IV) | Full LoH | High — ~6k pages, calendar routing |
| Teatinos / Verbum Dei PDFs | Order-specific / bilingual | Skip for general use |
| `palabra-dios-…` | Theology article | Not a prayer source |

## Daily coverage (typical feria)
| Group | When | Snippets (approx) |
|-------|------|-------------------|
| Maitines (Oficio) | 00:00 | ~8–12 |
| Ángelus | 06:00 | 1 |
| Laudes | 06:00 | ~10–14 |
| Tercia | 09:00 | ~6–9 |
| Ángelus | 12:00 | 1 |
| Sexta | 12:00 | ~6–9 |
| Nona | 15:00 | ~6–9 |
| Ángelus | 18:00 | 1 |
| Vísperas | 18:00 | ~9–12 |
| Completas | 21:00 | ~6–8 |
| **Day total** | | **~58–65 hour snippets + 3 Ángelus ≈ 61–68** |

Measured 2026-07-09 (feria): **58 + 3 = 61 slots**.

**v1.4.1 — clock windows:** snippets stay inside their hour block (not smeared over 24h).
Ángelus gets a 3‑min lead-in at 06/12/18; then the hour fills until the next mark.

| Window | Clock | App dwell |
|--------|-------|-----------|
| Maitines | 00–06 | ~6h |
| Ángelus + Laudes | 06–09 | 3m + ~3h |
| Tercia | 09–12 | ~3h |
| Ángelus + Sexta | 12–15 | 3m + ~3h |
| Nona | 15–18 | ~3h |
| Ángelus + Vísperas | 18–21 | 3m + ~3h |
| Completas | 21–24 | ~3h |

Static fallback (offline): **35 hour snippets + 3 Ángelus = 38**.
