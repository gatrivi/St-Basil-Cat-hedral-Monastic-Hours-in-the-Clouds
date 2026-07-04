# Cathedral — Developer Handover & Context (v1.3.0)

## 1. Project Overview
A monastic prayer application (Liturgical Hours) featuring AI-generated prayers, procedural visuals ("Cosmic Resonator"), and a community-driven manual voice recording system.

## 2. Technical Architecture

### Audio Pipeline (Strict Priority)
1.  **Manual Recordings (Firebase):** Checks RTDB metadata for a user-recorded `.wav` in Firebase Storage.
2.  **Piper TTS (Local/Server):** High-quality local neural TTS (default at `127.0.0.1:3001`).
3.  **Gemini Cloud TTS:** Flash 2.0 preview model for one-shot audio.
4.  **Robotic Fallback:** *DISABLED* by default to preserve atmosphere.

### Data & Persistence
- **Cloud:** Firebase (RTDB for prayer cache and recording metadata; Storage for `.wav` files).
- **Local:** `localStorage` for temporary prayer text caching to minimize API hits.
- **Fluid UI:** Typography uses `clamp()` for scaling between 5" phones and 75" 4K TVs.
- **Animations:** `AnimatePresence` set to `mode="wait"` for seamless liturgical transitions.

### Key Shortcuts & Controls
- `[V]`: Toggle Voice Recorder (MediaRecorder API → Firebase).
- `[Space]`: Play/Pause.
- `[Arrows]`: Fragment navigation (D-pad/Remote friendly).
- `[M]`: Mute.

## 3. Pending Tasks
- [ ] **PWA Manifest:** Enable "Install to Home Screen" for better TV/Mobile UX.
- [ ] **A11y:** Add an explicit font-size toggle for vision-impaired users.
- [ ] **Offline MP3s:** Pre-record the 7 fallback hours for true zero-network operation.

## 4. Operational Notes
- **TTS Server:** Ensure the Piper provider is running locally if AI synthetic voice is required.
- **Firebase:** Config is hardcoded in `src/services/firebase.ts`. Rules allow public read/write for devtrivi project (verify for production).

---
*Resume session by reading `ASSESSMENT.md` and `src/App.tsx` for latest UI state.*
