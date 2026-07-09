import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Menu, X, Mic, Waves, Eye, EyeOff, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentAndNextHour, LiturgicalHour } from './lib/hours';
import { LiturgicalFragment } from './lib/liturgicalFragments';
import { getDaySlots, getDayPosition, getCoverageSummary, setOfficePlaylist } from './lib/liturgicalDay';
import { APP_NAME } from './lib/brand';
import { DayPlaylistSidebar } from './components/DayPlaylistSidebar';
import { useBackground } from './lib/backgrounds';
import { useCosmicResonator } from './sacred/useCosmicResonator';
import { generatePrayerText, generateAudioOrFallback, SpeechController } from './services/gemini';
import { fetchOfficeDay, dateKey } from './services/liturgyOffice';
import { Recorder } from './components/Recorder';
import { AutoPager } from './components/AutoPager';
import { getPrayerRecordingMetadata } from './services/recordings';
import { perfLog } from './lib/perfLog';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.5';

type FontScale = 'sm' | 'md' | 'lg';
const FONT_SCALE_KEY = 'cathedral-font-scale';

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

/** Stable gold — hour-based accent thrash felt like a seizure on phones. */
const ACCENT_GOLD = '#d4af37';

// ─── Hard Reset for Smart TVs ───
const rechargeChapel = () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) { /* ignore */ }
  window.location.reload();
};

/** BG image + one soft vignette. Nothing else. */
function BackgroundLayers({ currentHour }: { currentHour: LiturgicalHour | null }) {
  const { currentSrc } = useBackground(currentHour?.name ?? null);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${currentSrc})` }}
      />
      <div className="read-vignette" />
    </div>
  );
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentHour, setCurrentHour] = useState<LiturgicalHour | null>(null);
  const [nextHour, setNextHour] = useState<LiturgicalHour | null>(null);
  const [fragment, setFragment] = useState<LiturgicalFragment | null>(null);
  const [fragmentIndex, setFragmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(() => {
    try { return localStorage.getItem('cathedral-ambient') === 'true'; } catch { return false; }
  });
  const [hasRecording, setHasRecording] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    try {
      const v = localStorage.getItem(FONT_SCALE_KEY);
      if (v === 'sm' || v === 'md' || v === 'lg') return v;
    } catch { /* ignore */ }
    return 'md';
  });
  const [manualSlotIndex, setManualSlotIndex] = useState<number | null>(null);
  const [playlistRev, setPlaylistRev] = useState(0);
  const [officeLabel, setOfficeLabel] = useState('Salterio local');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechController | null>(null);
  const touchStartX = useRef<number | null>(null);
  const lastPlayedHourRef = useRef<string | null>(null);
  const prayerTextRef = useRef<HTMLDivElement | null>(null);
  const manualSlotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSlotIndexRef = useRef<number | null>(null);
  const lastOfficeDateRef = useRef(dateKey(new Date()));
  const tickCountRef = useRef(0);

  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    perfLog('boot', { version: VERSION, href: window.location.href });
  }, []);

  useEffect(() => {
    // Phone landscape: short height, not narrow width (width is often >767 in landscape).
    const mq = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    const update = () => setIsLandscapeMobile(mq.matches);
    update();
    (mq.addEventListener ? mq.addEventListener('change', update) : mq.addListener(update));
    return () => {
      (mq.removeEventListener ? mq.removeEventListener('change', update) : mq.removeListener(update));
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--color-monastery-accent', ACCENT_GOLD);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
    try {
      localStorage.setItem(FONT_SCALE_KEY, fontScale);
    } catch { /* ignore */ }
  }, [fontScale]);

  const cycleFontScale = useCallback(() => {
    setFontScale(prev => (prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : 'sm'));
  }, []);

  const syncSlotToView = useCallback((slotIndex: number) => {
    if (lastSlotIndexRef.current === slotIndex) return;
    lastSlotIndexRef.current = slotIndex;
    const slot = getDaySlots()[slotIndex];
    if (!slot) return;
    perfLog('slot-sync:apply', { slotIndex, title: slot.title });
    setFragment(slot.fragment);
    setFragmentIndex(slot.fragmentIndex);
  }, []);

  const bumpManualSlot = useCallback((delta: number) => {
    const slots = getDaySlots();
    const base = manualSlotIndex ?? getDayPosition(currentTime).slotIndex;
    const next = (base + delta + slots.length) % slots.length;
    perfLog('manual-nav', { delta, next });
    setManualSlotIndex(next);
    syncSlotToView(next);
    lastInteractionRef.current = Date.now();
    if (manualSlotTimerRef.current) clearTimeout(manualSlotTimerRef.current);
    manualSlotTimerRef.current = setTimeout(() => setManualSlotIndex(null), 5 * 60 * 1000);
  }, [currentTime, manualSlotIndex, syncSlotToView]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const day = await fetchOfficeDay(new Date());
        if (cancelled) return;
        setOfficePlaylist(day.byHour, day.label);
        setOfficeLabel(day.label);
        setPlaylistRev(r => r + 1);
        const cov = getCoverageSummary();
        perfLog('office:live', {
          label: day.label,
          fragments: day.fragmentCount,
          slots: cov.prayerSnippets,
          group: cov.currentGroup,
          groupMins: cov.currentGroupMinutes,
        });
        lastSlotIndexRef.current = null;
        syncSlotToView(getDayPosition(new Date()).slotIndex);
      } catch (err) {
        console.warn('Oficio del día unavailable; using local psalter', err);
        perfLog('office:fallback', { err: String(err) });
      }
    })();
    return () => { cancelled = true; };
  }, [syncSlotToView]);

  const { init: initResonator, start: startResonator, stop: stopResonator, playBell: playResonatorBell, cleanup: cleanupResonator } = useCosmicResonator();
  const lastInteractionRef = useRef<number>(Date.now());
  const [fullPrayerText, setFullPrayerText] = useState<string>('');

  const handleCopy = useCallback(() => {
    if (!fragment) return;
    navigator.clipboard.writeText(fragment.text).catch(() => {});
  }, [fragment]);

  const playHour = useCallback(async (hour: LiturgicalHour) => {
    if (isLoadingAudio || isLoadingText) return;
    perfLog('playHour', hour.name);
    setIsLoadingText(true);
    setError(null);
    setUsingFallback(false);
    setAudioProgress(0);
    
    try {
      const now = new Date();
      const text = await generatePrayerText(hour.name, now);
      setFullPrayerText(text);
      // Display stays on liturgical slot (ticker); audio uses generated prayer only
      setIsLoadingText(false);
      
      setIsLoadingAudio(true);
      const audioResult = await generateAudioOrFallback(text, { hour: hour.name, index: fragmentIndex });
      if (audioRef.current) {
        if (audioResult.mode === 'manual' && audioResult.url) {
          audioRef.current.src = audioResult.url;
        } else if (audioResult.mode === 'piper' && audioResult.base64) {
          audioRef.current.src = `data:audio/wav;base64,${audioResult.base64}`;
        }
        audioRef.current.play().catch(e => {
          console.warn("Autoplay blocked", e);
          setAutoplayBlocked(true);
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setUsingFallback(true);
    } finally {
      setIsLoadingAudio(false);
      setIsLoadingText(false);
    }
  }, [isLoadingAudio, isLoadingText, fragmentIndex]);

  const togglePlayPause = useCallback(() => {
    if (autoplayBlocked) {
      handleManualStart();
      return;
    }
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    }
  }, [isPlaying, autoplayBlocked]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (audioRef.current) audioRef.current.muted = !isMuted;
  }, [isMuted]);

  const toggleAmbient = useCallback(() => {
    setAmbientEnabled(prev => {
      const next = !prev;
      localStorage.setItem('cathedral-ambient', String(next));
      return next;
    });
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => !prev);
  }, []);

  const handleManualStart = () => {
    setAutoplayBlocked(false);
    if (audioRef.current) audioRef.current.play();
    if (bellRef.current) bellRef.current.play();
  };

  const goToNextFragment = useCallback(() => {
    bumpManualSlot(1);
  }, [bumpManualSlot]);

  const goToPrevFragment = useCallback(() => {
    bumpManualSlot(-1);
  }, [bumpManualSlot]);

  const activeSlotIndex = manualSlotIndex ?? getDayPosition(currentTime).slotIndex;

  useEffect(() => {
    const pos = getDayPosition(currentTime);
    setReadingProgress(prev => {
      // Coarser steps → fewer scroll updates → less LCD flicker
      const next = Math.round(pos.slotProgress * 200) / 200;
      if (Math.abs(prev - next) < 0.002) return prev;
      return next;
    });
    if (manualSlotIndex === null) {
      syncSlotToView(pos.slotIndex);
    }
  }, [currentTime, manualSlotIndex, syncSlotToView, playlistRev]);

  useEffect(() => {
    const now = new Date();
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
    setCurrentHour(curr);
    setNextHour(next);
    syncSlotToView(getDayPosition(now).slotIndex);
  }, [syncSlotToView]);

  useEffect(() => {
    const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
    const markActive = () => { lastInteractionRef.current = Date.now(); };
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, markActive));
  }, []);

  useEffect(() => {
    if (ambientEnabled && !isMuted) {
      initResonator(true);
      startResonator();
    } else {
      stopResonator();
    }
  }, [ambientEnabled, isMuted, initResonator, startResonator, stopResonator]);

  useEffect(() => {
    if (!currentHour) {
      setHasRecording(false);
      return;
    }
    getPrayerRecordingMetadata(currentHour.name).then(meta => {
      setHasRecording(meta?.status === 'final');
    });
  }, [currentHour]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      const hourChanged = curr?.name !== currentHour?.name;

      setCurrentHour(prev => (prev?.name === curr?.name ? prev : curr));
      setNextHour(prev => (prev?.name === next?.name ? prev : next));

      if (manualSlotIndex === null) {
        syncSlotToView(getDayPosition(now).slotIndex);
      }

      tickCountRef.current += 1;
      if (tickCountRef.current % 60 === 0) {
        perfLog('tick:60s', { hour: curr?.name, slot: getDayPosition(now).slotIndex });
        const today = dateKey(now);
        if (today !== lastOfficeDateRef.current) {
          lastOfficeDateRef.current = today;
          fetchOfficeDay(now)
            .then(day => {
              setOfficePlaylist(day.byHour, day.label);
              setOfficeLabel(day.label);
              setPlaylistRev(r => r + 1);
              lastSlotIndexRef.current = null;
              syncSlotToView(getDayPosition(now).slotIndex);
            })
            .catch(() => { /* keep previous day until next try */ });
        }
      }

      if (hourChanged && curr) {
        perfLog('hour-change', { from: currentHour?.name, to: curr.name });
        setManualSlotIndex(null);
        lastSlotIndexRef.current = null;
        if (!isPlaying && !isLoadingAudio && !isLoadingText) {
          const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
          if (lastPlayedHourRef.current !== hourId) {
            lastPlayedHourRef.current = hourId;
            playResonatorBell();
            playHour(curr);
          }
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentHour, isPlaying, isLoadingAudio, isLoadingText, playHour, playResonatorBell, manualSlotIndex, syncSlotToView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showRecorder) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
      if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMute(); }
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); toggleAmbient(); }
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); toggleFocusMode(); }
      if (e.key.toLowerCase() === 'v') { e.preventDefault(); setShowRecorder(prev => !prev); }
      if (e.key.toLowerCase() === 'c') { e.preventDefault(); handleCopy(); }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); cycleFontScale(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToNextFragment(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrevFragment(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, toggleMute, toggleAmbient, toggleFocusMode, handleCopy, cycleFontScale, goToNextFragment, goToPrevFragment, showRecorder]);

  useEffect(() => {
    return () => { cleanupResonator(); };
  }, [cleanupResonator]);

  return (
    <div
      className={`h-screen flex overflow-hidden relative cursor-default ${focusMode ? 'focus-mode' : ''} ${isLandscapeMobile ? 'landscape-mobile' : ''} ${isLandscapeMobile && sidebarOpen ? 'sidebar-open' : ''}`}
      onClick={() => { if (autoplayBlocked) handleManualStart(); }}
    >
      <BackgroundLayers currentHour={currentHour} />
      <audio ref={bellRef} src={BELL_SOUND_URL} preload="auto" />
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); }} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onTimeUpdate={(e) => { const audio = e.currentTarget; if (audio.duration) { setAudioProgress(audio.currentTime); setAudioDuration(audio.duration); } }} onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)} />

      <header className={`mobile-chrome fixed top-0 left-0 right-0 z-40 flex items-center gap-1 px-1 ${focusMode ? 'opacity-0 pointer-events-none' : ''}`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
          className="mobile-chrome-btn"
          aria-label="Menú"
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        <p className="flex-1 text-center font-serif text-xs text-[var(--color-monastery-accent)] truncate leading-none">
          {currentHour?.name || APP_NAME} · {format(currentTime, 'HH:mm')}
        </p>
        <button
          type="button"
          className="mobile-chrome-btn"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
      </header>

      {/* Overlay drawer only — never a permanent desktop column */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="sidebar-panel sidebar-drawer fixed inset-y-0 left-0 z-50 w-[min(85vw,16rem)] flex flex-col pt-9">
            <DayPlaylistSidebar
              currentTime={currentTime}
              playlistRev={playlistRev}
              onPick={() => setSidebarOpen(false)}
            />
            <p className="mt-auto px-3 py-2 text-[9px] opacity-40 truncate" title={officeLabel}>
              {officeLabel} · v{VERSION}
            </p>
          </aside>
        </>
      )}

      <main
        className="prayer-main flex-1 flex flex-col relative min-w-0 pt-9"
        onTouchStart={(e) => { touchStartX.current = e.changedTouches[0].screenX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return;
          const diff = touchStartX.current - e.changedTouches[0].screenX;
          if (Math.abs(diff) > 50) {
            if (diff > 0) goToNextFragment();
            else goToPrevFragment();
          }
          touchStartX.current = null;
        }}
      >
        {showRecorder && currentHour && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowRecorder(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Recorder hour={currentHour.name} index={fragmentIndex} prayerText={fullPrayerText} onFinished={() => setShowRecorder(false)} onClose={() => setShowRecorder(false)} />
            </div>
          </div>
        )}

        <div
          ref={prayerTextRef}
          className="prayer-text-container flex-1 min-h-0 overflow-hidden relative px-3 py-2 md:px-10 md:py-6"
        >
          {fragment ? (
            <AutoPager key={`${activeSlotIndex}-${fragment.title}`} progress={readingProgress}>
              {fragment.text}
            </AutoPager>
          ) : (
            <p className="prayer-verse font-serif opacity-50 text-center mt-20">Entrando a la Capilla...</p>
          )}
        </div>

        {!focusMode && autoplayBlocked && !isPlaying && (
          <button
            type="button"
            className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 text-[10px] uppercase tracking-widest text-[var(--color-monastery-accent)] opacity-80"
            onClick={(e) => { e.stopPropagation(); handleManualStart(); }}
          >
            Toca para comenzar
          </button>
        )}

        {/* Optional desktop transport — hidden on small screens */}
        {!focusMode && (
          <div
            className="hidden md:flex h-10 border-t border-white/5 items-center px-4 gap-3 opacity-70 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={togglePlayPause} disabled={isLoadingAudio || isLoadingText} className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 hover:border-[var(--color-monastery-accent)] hover:text-[var(--color-monastery-accent)] transition-all disabled:opacity-30 shrink-0" title="Reproducir / Pausar (Espacio)">
              {isLoadingAudio || isLoadingText ? <Bell size={12} /> : isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
            </button>
            <button onClick={toggleFocusMode} className="opacity-70 hover:opacity-100 shrink-0" title="Modo Zen (Z)">
              {focusMode ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={toggleMute} className="opacity-70 hover:opacity-100 shrink-0" title="Silenciar (M)">
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button onClick={toggleAmbient} className={`opacity-70 hover:opacity-100 shrink-0 ${ambientEnabled ? 'text-[var(--color-monastery-accent)]' : ''}`} title="Ambiente (A)">
              <Waves size={14} />
            </button>
            <button onClick={() => setShowRecorder(!showRecorder)} className={`opacity-70 hover:opacity-100 shrink-0 relative ${showRecorder ? 'text-[var(--color-monastery-accent)]' : ''}`} title="Voz (V)">
              <Mic size={14} />
              {hasRecording && !showRecorder && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />}
            </button>
            <input
              type="range"
              className="scrubber-range flex-1 min-w-0"
              min={0}
              max={audioDuration > 0 ? audioDuration : 1}
              step={0.1}
              value={audioDuration > 0 ? Math.min(audioProgress, audioDuration) : 0}
              disabled={audioDuration <= 0}
              aria-label="Progreso del audio"
              onChange={(e) => {
                const t = Number(e.target.value);
                if (audioRef.current && audioDuration > 0) {
                  audioRef.current.currentTime = t;
                  setAudioProgress(t);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </main>
    </div>
  );
}
