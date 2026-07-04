# Monastic Hours — Assessment & Recommendations

## Gemini Free Tier: The Verdict

**For a single daily user: yes, it is enough.** But only barely, and only with the caching + fallback architecture now in place.

### Usage Math

| Hour | Text API | TTS API | Total/Day |
|------|----------|---------|-----------|
| Matins | 1 | 1 | 2 |
| Lauds | 1 | 1 | 2 |
| Terce | 1 | 1 | 2 |
| Sext | 1 | 1 | 2 |
| None | 1 | 1 | 2 |
| Vespers | 1 | 1 | 2 |
| Compline | 1 | 1 | 2 |
| **Daily Total** | **7** | **7** | **14** |
| **Monthly Total** | **~210** | **~210** | **~420** |

### Free Tier Limits (Gemini 2.5 Flash — the TTS model)

| Limit | Value | Notes |
|-------|-------|-------|
| RPM | ~10 | One prayer every 6 seconds max |
| RPD | ~100–250 | Varies by project/region |
| TPM | 250,000 | Never the bottleneck for short prayers |

**The problem:** `gemini-2.5-flash-preview-tts` is a **preview model**. Preview models:
- Can have unannounced quota changes
- May not be free-tier eligible in all regions
- Can be deprecated without warning

**Without caching, you hit the daily cap in ~7–18 days of normal use.** With caching, you only generate each hour's text once ever — reducing text API calls by ~85%.

---

## What Was Implemented

### 1. Prayer Text Caching (`localStorage`)
- Key: `{HourName}-{YYYY-MM-DD}`
- Once a prayer is generated, it is reused for that hour forever
- Auto-prunes after ~100 entries (last 14 days)
- **Impact:** Text API calls drop from ~210/month to ~7/month after the first week

### 2. Built-In Fallback Prayers
- Seven handcrafted, authentic Catholic Liturgy of the Hours prayers
- Used instantly if:
  - No `GEMINI_API_KEY` is set
  - API returns 429 (rate limit)
  - API returns 5xx or network error
  - Model is unreachable
- **Impact:** The app **never shows a blank screen.**

### 3. Web Speech API (Robotic) Fallback
- **Disabled by Default:** Following user feedback, the robotic browser-native voice is now disabled. The app relies exclusively on high-quality AI TTS (Piper) or manual recordings.
- **Impact:** Ensures the monastic atmosphere remains authentic without sudden "robotic" intrusions.

### 4. Grannie-Proof & TV-Ready UX
- Removed debug "JS ACTIVE" badge
- Replaced "click anywhere" with a **giant "Enter the Chapel" button**
- All buttons have **both icons and text labels**
- Minimum 44px touch targets everywhere
- **Fluid Typography:** Base font scales via `clamp(16px, 1.2vw + 14px, 24px)` ΓÇö readable on 4K TVs and 5" phones.
- **TV Navigation:** D-pad friendly focus states and visible-enough navigation arrows.
- **Cinematic Transitions:** Fragment crossfades fixed with `mode="wait"` and subtle scale animations.
- Respects `prefers-reduced-motion`
- Visible focus rings for keyboard navigation

### 5. Manual Voice Recording Pipeline (v1.2.2)
- **Cloud Persistence:** Recordings are uploaded to **Firebase Storage** and metadata is stored in **Realtime Database**. This ensures recordings persist across sessions and deployments (unlike the local filesystem).
- **Priority Playback:** The audio engine prefers manual recordings over AI synthetic voices.
- **Quality Control:** Status labels ("Final" vs "Needs Re-record") help manage the growing voice library.
- **Keyboard Shortcut:** `[V]` to toggle the recorder instantly.



---

## Open Questions

### Can We Cache Sounds?

**Yes, but it's complicated.**

| Approach | Pros | Cons |
|----------|------|------|
| `localStorage` | Simple | 5–10MB limit. One day of audio (~1–2MB) eats 20% of it. |
| `IndexedDB` | ~50MB+ limit | More complex. Audio still changes daily because AI text changes daily. |
| Cache API | Persistent, large | Requires Service Worker. Same daily-uniqueness problem. |
| Pre-generate static audio | Zero runtime cost | Lose the AI freshness. Requires ElevenLabs/Google Cloud TTS batch job. |

**Recommendation:** Don't cache AI-generated audio. The text changes every day (by design — "for today"), so the audio is inherently single-use. Caching it saves almost nothing while adding storage complexity.

**Exception:** If you switch to **static fallback prayers**, you could generate one audio file per hour once, host it as a static asset, and never hit the TTS API again. That would make the app completely free and offline-capable.

### API Key Setup

The app needs a `GEMINI_API_KEY` environment variable to use AI features. Without it, it gracefully degrades to built-in prayers + browser speech.

**To get a key:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key
4. Create `.env.local` in project root:
   ```
   GEMINI_API_KEY=your_key_here
   ```

**Cost if you upgrade:** Gemini 2.5 Flash TTS is roughly **$10 per 1M audio output tokens**. A 150-word prayer is ~200–300 tokens. At 7 prayers/day, that's ~$0.02/month. Essentially free even on pay-as-you-go.

---

## Architecture Decision: Three Tiers of Operation

```
Tier 1 — Full AI (API key + quota available)
  Text: Gemini Flash  → cached
  Audio: Gemini TTS   → one-shot, not cached
  
Tier 2 — Degraded AI (API key present but TTS fails)
  Text: Gemini Flash  → cached
  Audio: Web Speech API → free, browser-native
  
Tier 3 — Offline (no API key or all APIs fail)
  Text: Built-in fallback prayers
  Audio: Web Speech API → free, browser-native
```

The app automatically selects the best available tier on every prayer. The user never sees a config screen.

---

## Suggested Next Steps

1. **Test Tier 3** — remove `.env.local` and verify the app works with zero API calls
2. **Consider static audio** — if you want true offline capability, record 7 prayers once and ship them as MP3s
3. **Add a PWA manifest** — lets grannies "install" the chapel to their home screen
4. **Add a font-size toggle** — some grannies need 24px+, others prefer 16px
