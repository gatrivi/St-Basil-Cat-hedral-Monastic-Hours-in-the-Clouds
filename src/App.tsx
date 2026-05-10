import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, SkipForward, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { generatePrayerText, generateAudioOrFallback, SpeechController } from './services/gemini';
import { loadNotebook, saveNotebook } from './services/notebook';
import { getCachedAudio, setCachedAudio } from './services/prayerCache';
import { uploadAudio } from './services/firebase';
import { useCosmicResonator } from './sacred/useCosmicResonator';
import { SacredDrawing } from './sacred/procedural-rose';

const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

function base64ToBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const byteCharacters = atob(base64);
  const byteArrays: Uint8Array[] = [];
  for (let i = 0; i < byteCharacters.length; i += 512) {
    const slice = byteCharacters.slice(i, i + 512);
    const byteNumbers = new Array(slice.length);
    for (let j = 0; j < slice.length; j++) {
      byteNumbers[j] = slice.charCodeAt(j);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mimeType });
}

function Notebook() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadNotebook()
      .then(text => setContent(text))
      .catch(err => console.error('Failed to load notebook', err));
  }, []);

  const handleSave = async (newContent: string) => {
    setContent(newContent);
    setIsSaving(true);
    try {
      await saveNotebook(newContent);
    } catch (err) {
      console.error('Failed to save notebook', err);
    }
    setIsSaving(false);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-64 md:h-full">
      <h3 className="text-sm uppercase tracking-widest opacity-60 mb-4 flex justify-between items-center">
        <span className="flex items-center gap-2"><BookOpen size={18} /> Personal Notebook</span>
        {isSaving && <span className="text-[var(--color-monastery-accent)]">Saving...</span>}
      </h3>
      <textarea
        value={content}
        onChange={(e) => handleSave(e.target.value)}
        className="w-full h-full bg-transparent resize-none outline-none font-serif text-xl leading-relaxed text-[var(--color-monastery-text)] placeholder:opacity-30"
        placeholder="Write your thoughts here..."
      />
    </div>
  );
}

export default function App() {
  const { init: initResonator, start: startResonator, stop: stopResonator, playBell: playResonatorBell } = useCosmicResonator();

  const [hasEntered, setHasEntered] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentHour, setCurrentHour] = useState<LiturgicalHour | null>(null);
  const [nextHour, setNextHour] = useState<LiturgicalHour | null>(null);
  const [prayerText, setPrayerText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioMode, setAudioMode] = useState<'gemini' | 'speech' | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Preparing your prayer...');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const speechCtrlRef = useRef<SpeechController | null>(null);
  const lastPlayedHourRef = useRef<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playHourRef = useRef<(hour: LiturgicalHour, fadeIn?: boolean) => Promise<void>>(async () => {});

  // ─── Clock & Auto-play ───
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now);
      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      setCurrentHour(curr);
      setNextHour(next);

      if (hasEntered && curr && !isPlaying && !isLoading) {
        const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
        if (lastPlayedHourRef.current !== hourId) {
          const currentMinutes = now.getMinutes();
          if (currentMinutes < 5) {
            lastPlayedHourRef.current = hourId;
            playHourRef.current(curr);
          }
        }
      }
    };

    tick();
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, [hasEntered, isPlaying, isLoading]);

  // ─── Audio Progress Timer ───
  const startProgressTimer = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      if (audioRef.current?.src && !speechCtrlRef.current) {
        setAudioProgress(audioRef.current.currentTime);
        setAudioDuration(audioRef.current.duration || 0);
      } else if (speechCtrlRef.current) {
        setAudioProgress(speechCtrlRef.current.getCurrentTime());
        setAudioDuration(speechCtrlRef.current.getDuration());
      }
    }, 250);
  }, []);

  const stopProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // ─── Enter Chapel ───
  const handleEnter = () => {
    setHasEntered(true);
    initResonator(!isMuted);
    if (currentHour) {
      const now = new Date();
      const hourId = `${format(now, 'yyyy-MM-dd')}-${currentHour.name}`;
      lastPlayedHourRef.current = hourId;
      playHour(currentHour, true);
    }
  };

  // ─── Play Hour ───
  const playHour = async (hour: LiturgicalHour, fadeIn: boolean = false) => {
    if (isPlaying || isLoading) return;
    setIsLoading(true);
    setPrayerText('');
    setError(null);
    setLoadingMessage('Preparing your prayer...');

    // Clean up any previous speech
    speechCtrlRef.current?.stop();
    speechCtrlRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    try {
      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');

      // 1. Get text (cached, Gemini, or fallback)
      setLoadingMessage('Finding the words...');
      const text = await generatePrayerText(hour.name, now);
      setPrayerText(text);

      // 2. Check for cached audio URL
      setLoadingMessage('Preparing the reading...');
      const cachedUrl = await getCachedAudio(hour.name, dateStr);
      let audioSrc: string | null = cachedUrl;
      let audioModeResult: 'gemini' | 'speech' = 'gemini';
      let speechCtrl: SpeechController | null = null;

      if (!audioSrc) {
        // Generate new audio
        const audioResult = await generateAudioOrFallback(text);
        if (audioResult.mode === 'gemini') {
          // Upload to Firebase Storage
          setLoadingMessage('Saving the reading...');
          try {
            const blob = base64ToBlob(audioResult.base64);
            const url = await uploadAudio(`audio/${dateStr}/${hour.name}.wav`, blob);
            await setCachedAudio(hour.name, dateStr, url);
            audioSrc = url;
          } catch (uploadErr) {
            console.warn('[Cathedral] Storage upload failed, playing from memory:', uploadErr);
            audioSrc = `data:audio/wav;base64,${audioResult.base64}`;
          }
        } else {
          audioModeResult = 'speech';
          speechCtrl = audioResult.controller;
        }
      }

      // 3. Play bell
      if (!isMuted) {
        playResonatorBell();
      }
      if (bellRef.current && !isMuted) {
        bellRef.current.currentTime = 0;
        bellRef.current.volume = fadeIn ? 0.5 : 1;
        await bellRef.current.play();
      }

      // 4. Schedule prayer playback after bell
      setTimeout(() => {
        if (audioModeResult === 'gemini' && audioSrc && audioRef.current) {
          setAudioMode('gemini');
          audioRef.current.src = audioSrc;
          audioRef.current.muted = isMuted;
          audioRef.current.volume = fadeIn ? 0 : 1;
          setIsPlaying(true);
          setIsLoading(false);
          startResonator();
          startProgressTimer();
          audioRef.current.play().then(() => {
            if (fadeIn && audioRef.current) {
              let vol = 0;
              const fadeInterval = setInterval(() => {
                vol += 0.05;
                if (vol >= 1) {
                  if (audioRef.current) audioRef.current.volume = 1;
                  clearInterval(fadeInterval);
                } else {
                  if (audioRef.current) audioRef.current.volume = vol;
                }
              }, 250);
            }
          });
        } else if (speechCtrl) {
          setAudioMode('speech');
          speechCtrlRef.current = speechCtrl;
          speechCtrl.onPlay = () => {
            setIsPlaying(true);
            startResonator();
            startProgressTimer();
          };
          speechCtrl.onEnd = () => {
            setIsPlaying(false);
            stopResonator();
            stopProgressTimer();
          };
          speechCtrl.onPause = () => {
            setIsPlaying(false);
            stopResonator();
          };
          setIsPlaying(true);
          setIsLoading(false);
          speechCtrl.play();
        }
      }, 3500);
    } catch (err) {
      console.error('playHour error:', err);
      setError('Something went wrong. Please press the button to try again.');
      setIsLoading(false);
    }
  };
  playHourRef.current = playHour;

  // ─── Toggle Play / Pause ───
  const togglePlayPause = useCallback(() => {
    if (audioMode === 'gemini' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        stopResonator();
        stopProgressTimer();
      } else if (audioRef.current.src) {
        audioRef.current.play();
        setIsPlaying(true);
        startResonator();
        startProgressTimer();
      } else if (currentHour) {
        playHour(currentHour);
      }
    } else if (audioMode === 'speech' && speechCtrlRef.current) {
      if (isPlaying) {
        speechCtrlRef.current.pause();
        setIsPlaying(false);
        stopResonator();
        stopProgressTimer();
      } else {
        speechCtrlRef.current.play();
        setIsPlaying(true);
        startResonator();
        startProgressTimer();
      }
    } else if (currentHour) {
      playHour(currentHour);
    }
  }, [isPlaying, currentHour, audioMode, startResonator, stopResonator, startProgressTimer, stopProgressTimer]);

  // ─── Toggle Mute ───
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      if (bellRef.current) bellRef.current.muted = next;
      return next;
    });
  }, []);

  // ─── Scrubber Click ───
  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioMode === 'gemini' && audioRef.current && audioDuration > 0) {
      audioRef.current.currentTime = pct * audioDuration;
    }
    // Web Speech doesn't support seeking
  }, [audioMode, audioDuration]);

  // ─── Console Watermark ───
  useEffect(() => {
    console.log(
      "%c ✠ MONASTIC HOURS %c by GATRIVI \n%cOriginal work at gatrivi.com | @gatrivi on socials",
      "color: #d4af37; font-size: 20px; font-weight: bold; font-family: serif;",
      "color: #888; font-size: 14px; font-family: serif;",
      "color: #666; font-size: 12px; font-style: italic;"
    );
  }, []);

  // ─── Landing Screen ───
  if (!hasEntered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <div className="atmosphere" />
        <div className="stained-glass" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2 }}
          className="text-center space-y-10 z-10 max-w-xl"
        >
          <h1 className="font-serif text-6xl md:text-8xl font-light tracking-widest text-[var(--color-monastery-accent)]">
            Monastic Hours
          </h1>
          <p className="text-lg md:text-xl uppercase tracking-[0.3em] opacity-70">
            A Chapel in Your Pocket
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEnter}
            className="mt-8 px-12 py-5 rounded-full border-2 border-[var(--color-monastery-accent)] text-[var(--color-monastery-accent)] text-xl md:text-2xl font-serif tracking-wider hover:bg-[var(--color-monastery-accent)] hover:text-black transition-colors cursor-pointer"
          >
            Enter the Chapel
          </motion.button>
          <motion.p
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="text-sm opacity-50 pt-4"
          >
            Press the button to begin
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ─── Main Screen ───
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 relative">
      <div className="atmosphere" />

      {/* Hidden Audio Elements */}
      <audio ref={bellRef} src={BELL_SOUND_URL} preload="auto" />
      <audio
        ref={audioRef}
        onEnded={() => { setIsPlaying(false); stopResonator(); stopProgressTimer(); }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) {
            setAudioProgress(audio.currentTime);
            setAudioDuration(audio.duration);
          }
        }}
        onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
      />

      <main className="w-full max-w-6xl flex flex-col gap-6 md:gap-8 z-10">

        {/* Header / Clock */}
        <header className="text-center space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-6xl md:text-8xl font-light tracking-widest text-[var(--color-monastery-accent)]"
          >
            {format(currentTime, 'HH:mm')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-base md:text-lg uppercase tracking-[0.3em] opacity-70"
          >
            {format(currentTime, 'EEEE, MMMM do')}
          </motion.p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

          {/* Left Column: Hours */}
          <div className="flex flex-col gap-6">
            {/* Current Hour */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
              <p className="text-sm uppercase tracking-widest opacity-60 mb-3 flex items-center gap-2 z-10">
                <Clock size={18} /> Now Praying
              </p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentHour?.name || 'empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 1 }}
                  className="flex flex-col justify-between h-full"
                >
                  <div>
                    <h2 className="font-serif text-4xl md:text-5xl text-[var(--color-monastery-accent)]">{currentHour?.name || '...'}</h2>
                    <p className="text-base md:text-lg opacity-80 mt-2">{currentHour?.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-base opacity-60">{currentHour?.timeString}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Next Hour */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between opacity-80 relative overflow-hidden">
              <p className="text-sm uppercase tracking-widest opacity-60 mb-3 z-10">Coming Next</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={nextHour?.name || 'empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 1 }}
                  className="flex flex-col justify-between h-full"
                >
                  <div>
                    <h2 className="font-serif text-3xl md:text-4xl">{nextHour?.name || '...'}</h2>
                    <p className="text-base opacity-70 mt-2">{nextHour?.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-base opacity-60">{nextHour?.timeString}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Schedule Toggle */}
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="glass-panel p-5 rounded-xl text-base uppercase tracking-widest hover:text-[var(--color-monastery-accent)] transition-colors text-center cursor-pointer"
            >
              {showSchedule ? 'Hide Daily Schedule' : 'View Daily Schedule'}
            </button>
          </div>

          {/* Middle Column: Player & Prayer */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Player Controls */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col items-center gap-5 w-full">
              <div className="flex items-center justify-center gap-6 md:gap-10">
                {/* Mute */}
                <button
                  onClick={toggleMute}
                  className="flex flex-col items-center gap-2 hover:text-[var(--color-monastery-accent)] transition-colors cursor-pointer min-w-[64px]"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={28} /> : <Volume2 size={28} />}
                  <span className="text-xs uppercase tracking-wider opacity-70">{isMuted ? 'Muted' : 'Sound'}</span>
                </button>

                {/* Play / Pause */}
                <button
                  onClick={togglePlayPause}
                  disabled={isLoading}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-[var(--color-monastery-accent)] flex items-center justify-center text-[var(--color-monastery-accent)] hover:bg-[var(--color-monastery-accent)] hover:text-black transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--color-monastery-accent)] cursor-pointer"
                  title="Play or Pause"
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    >
                      <Bell size={32} />
                    </motion.div>
                  ) : isPlaying ? (
                    <Pause size={32} />
                  ) : (
                    <Play size={32} className="ml-1" />
                  )}
                </button>

                {/* Skip */}
                <button
                  onClick={() => nextHour && playHour(nextHour)}
                  disabled={isLoading || isPlaying}
                  className="flex flex-col items-center gap-2 hover:text-[var(--color-monastery-accent)] transition-colors disabled:opacity-50 cursor-pointer min-w-[64px]"
                  title="Next Hour"
                >
                  <SkipForward size={28} />
                  <span className="text-xs uppercase tracking-wider opacity-70">Next</span>
                </button>
              </div>

              {/* Audio Progress */}
              {audioDuration > 0 && (
                <div className="w-full flex items-center gap-3 px-2 md:px-4">
                  <span className="text-sm font-mono opacity-60 w-12 text-right">
                    {Math.floor(audioProgress / 60)}:{String(Math.floor(audioProgress % 60)).padStart(2, '0')}
                  </span>
                  <div
                    className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                    onClick={handleScrub}
                  >
                    <motion.div
                      className="h-full bg-[var(--color-monastery-accent)]"
                      style={{ width: `${(audioProgress / audioDuration) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono opacity-60 w-12">
                    {Math.floor(audioDuration / 60)}:{String(Math.floor(audioDuration % 60)).padStart(2, '0')}
                  </span>
                </div>
              )}

              {/* Loading / Status */}
              {isLoading && (
                <p className="text-sm opacity-70 animate-pulse">{loadingMessage}</p>
              )}
              {audioMode === 'speech' && !isLoading && (
                <p className="text-xs opacity-50 uppercase tracking-wider">Speaking in your browser</p>
              )}
            </div>

            {/* Prayer Text Display */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl flex-grow flex flex-col relative">
              <div className="absolute top-4 right-4 opacity-20 pointer-events-none">
                <SacredDrawing symbolKey="cross" progress={isPlaying ? 0.8 : 0.3} size={60} />
              </div>
              <h3 className="text-sm uppercase tracking-widest opacity-60 mb-4 flex items-center gap-2">
                <BookOpen size={18} /> Prayer
              </h3>
              <div className="flex-grow overflow-y-auto max-h-[50vh] pr-2">
                <AnimatePresence mode="wait">
                  {error ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-4 text-center"
                    >
                      <AlertCircle size={40} className="text-red-400 opacity-80" />
                      <p className="font-serif text-xl italic opacity-80">{error}</p>
                      <button
                        onClick={() => currentHour && playHour(currentHour)}
                        className="mt-2 px-6 py-3 rounded-full border border-[var(--color-monastery-accent)] text-[var(--color-monastery-accent)] hover:bg-[var(--color-monastery-accent)] hover:text-black transition-colors text-sm uppercase tracking-widest cursor-pointer"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  ) : prayerText ? (
                    <motion.div
                      key="text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="font-serif text-xl md:text-2xl leading-relaxed space-y-5 text-center markdown-body"
                    >
                      <Markdown>{prayerText}</Markdown>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex items-center justify-center opacity-40 font-serif italic text-2xl"
                    >
                      The chapel is quiet. Press the play button to begin.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Row: Notebook & Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Notebook />

          <AnimatePresence>
            {showSchedule && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-panel p-6 rounded-2xl overflow-hidden"
              >
                <h3 className="text-sm uppercase tracking-widest opacity-60 mb-4">Daily Rhythm</h3>
                <div className="space-y-3">
                  {HOURS_SCHEDULE.map((h) => (
                    <div key={h.name} className={`flex justify-between items-center p-3 rounded-lg ${currentHour?.name === h.name ? 'bg-[var(--color-monastery-accent)] text-black' : 'hover:bg-white/5'}`}>
                      <div>
                        <span className="font-serif font-bold text-lg mr-3">{h.name}</span>
                        <span className="text-sm opacity-80">{h.description}</span>
                      </div>
                      <span className="font-mono text-base">{h.timeString}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-6 border-t border-white/5 flex flex-col items-center gap-4 opacity-40 hover:opacity-100 transition-opacity duration-500">
          <p className="text-sm uppercase tracking-[0.4em] font-serif">
            Built by <a href="https://gatrivi.com" target="_blank" rel="noopener noreferrer" className="text-[var(--color-monastery-accent)] hover:underline">Gatrivi</a>
          </p>
          <div className="flex gap-6 text-xs uppercase tracking-widest">
            <a href="https://x.com/gatrivi" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Twitter</a>
            <a href="https://reddit.com/u/gatrivi" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Reddit</a>
            <span className="cursor-default">✠</span>
            <a href="https://gatrivi.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Portfolio</a>
          </div>
        </footer>

      </main>
    </div>
  );
}
