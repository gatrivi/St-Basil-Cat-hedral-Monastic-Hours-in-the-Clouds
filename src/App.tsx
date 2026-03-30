import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, SkipForward, BookOpen, Clock } from 'lucide-react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { generatePrayerText, generatePrayerAudio } from './services/gemini';

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

function Notebook() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/notebook')
      .then(res => res.json())
      .then(data => setContent(data.content))
      .catch(err => console.error("Failed to load notebook", err));
  }, []);

  const handleSave = async (newContent: string) => {
    setContent(newContent);
    setIsSaving(true);
    try {
      await fetch('/api/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      });
    } catch (err) {
      console.error("Failed to save notebook", err);
    }
    setIsSaving(false);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-64 md:h-full">
      <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 flex justify-between">
        <span>Personal Notebook</span>
        {isSaving && <span className="text-[var(--color-monastery-accent)]">Saving...</span>}
      </h3>
      <textarea
        value={content}
        onChange={(e) => handleSave(e.target.value)}
        className="w-full h-full bg-transparent resize-none outline-none font-serif text-lg leading-relaxed text-[var(--color-monastery-text)] placeholder:opacity-30"
        placeholder="Write your chores and thoughts here..."
      />
    </div>
  );
}

export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentHour, setCurrentHour] = useState<LiturgicalHour | null>(null);
  const [nextHour, setNextHour] = useState<LiturgicalHour | null>(null);
  const [prayerText, setPrayerText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);

  const lastPlayedHourRef = useRef<string | null>(null);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      setCurrentHour(curr);
      setNextHour(next);
      
      // Auto-play logic (always on, simulating live monastery)
      if (hasEntered && curr && !isPlaying && !isLoading) {
        const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
        if (lastPlayedHourRef.current !== hourId) {
          // Check if we are within the first 5 minutes of the hour
          const currentMinutes = now.getMinutes();
          if (currentMinutes < 5) {
            lastPlayedHourRef.current = hourId;
            playHour(curr);
          }
        }
      }
    }, 60000);

    // Initial setup
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(new Date());
    setCurrentHour(curr);
    setNextHour(next);

    return () => clearInterval(timer);
  }, [hasEntered, isPlaying, isLoading]);

  const handleEnter = () => {
    setHasEntered(true);
    if (currentHour) {
      const now = new Date();
      const hourId = `${format(now, 'yyyy-MM-dd')}-${currentHour.name}`;
      lastPlayedHourRef.current = hourId;
      playHour(currentHour, true);
    }
  };

  const playHour = async (hour: LiturgicalHour, fadeIn: boolean = false) => {
    if (isPlaying) return;
    setIsLoading(true);
    setPrayerText('');
    
    try {
      // 1. Generate Text
      const text = await generatePrayerText(hour.name, new Date());
      setPrayerText(text);

      // 2. Generate Audio
      const audioBase64 = await generatePrayerAudio(text);
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.muted = isMuted;
        if (fadeIn) {
          audioRef.current.volume = 0;
        } else {
          audioRef.current.volume = 1;
        }
      }

      // 3. Play Bell
      if (bellRef.current && !isMuted) {
        bellRef.current.currentTime = 0;
        bellRef.current.volume = fadeIn ? 0.5 : 1;
        await bellRef.current.play();
      }
      
      // 4. Play Audio after a short delay for the bell
      setTimeout(async () => {
        if (audioRef.current) {
          setIsPlaying(true);
          setIsLoading(false);
          await audioRef.current.play();
          
          if (fadeIn) {
            // Fade in over 5 seconds
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
        }
      }, 4000); // 4 seconds for the bell to ring out
      
    } catch (error) {
      console.error('Failed to play hour:', error);
      setPrayerText('The monks are in silent contemplation.');
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current.src) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (currentHour) {
      playHour(currentHour);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) audioRef.current.muted = !isMuted;
    if (bellRef.current) bellRef.current.muted = !isMuted;
  };

  if (!hasEntered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative cursor-pointer" onClick={handleEnter}>
        <div className="atmosphere"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2 }}
          className="text-center space-y-8 z-10"
        >
          <h1 className="font-serif text-5xl md:text-7xl font-light tracking-widest text-[var(--color-monastery-accent)]">
            Monastic Hours
          </h1>
          <p className="text-sm uppercase tracking-[0.3em] opacity-60">
            Enter the Chapel
          </p>
          <motion.div 
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="mt-12 opacity-50"
          >
            Click anywhere to begin
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="atmosphere"></div>
      
      {/* Hidden Audio Elements */}
      <audio ref={bellRef} src={BELL_SOUND_URL} preload="auto" />
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)} 
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <main className="w-full max-w-5xl flex flex-col gap-8 z-10">
        
        {/* Header / Clock */}
        <header className="text-center space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-5xl md:text-7xl font-light tracking-widest text-[var(--color-monastery-accent)]"
          >
            {format(currentTime, 'HH:mm')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs uppercase tracking-[0.3em] opacity-60"
          >
            {format(currentTime, 'EEEE, MMMM do')}
          </motion.p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Left Column: Schedule & Info */}
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
              <p className="text-xs uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2 z-10">
                <Clock size={14} /> Current Hour
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
                    <h2 className="font-serif text-3xl text-[var(--color-monastery-accent)]">{currentHour?.name || '...'}</h2>
                    <p className="text-sm opacity-70 mt-1">{currentHour?.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-sm opacity-50">{currentHour?.timeString}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between opacity-70 relative overflow-hidden">
              <p className="text-xs uppercase tracking-widest opacity-50 mb-2 z-10">Next Hour</p>
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
                    <h2 className="font-serif text-2xl">{nextHour?.name || '...'}</h2>
                    <p className="text-sm opacity-70 mt-1">{nextHour?.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-sm opacity-50">{nextHour?.timeString}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setShowSchedule(!showSchedule)}
              className="glass-panel p-4 rounded-xl text-xs uppercase tracking-widest hover:text-[var(--color-monastery-accent)] transition-colors text-center"
            >
              {showSchedule ? 'Hide Schedule' : 'View Full Schedule'}
            </button>
          </div>

          {/* Middle Column: Player & Text */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Player Controls */}
            <div className="glass-panel p-4 rounded-3xl flex items-center justify-center gap-8 w-full">
              <button onClick={toggleMute} className="hover:text-[var(--color-monastery-accent)] transition-colors">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              
              <button 
                onClick={togglePlayPause}
                disabled={isLoading}
                className="w-16 h-16 rounded-full border border-[var(--color-monastery-accent)] flex items-center justify-center text-[var(--color-monastery-accent)] hover:bg-[var(--color-monastery-accent)] hover:text-black transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--color-monastery-accent)]"
              >
                {isLoading ? (
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Bell size={24} />
                  </motion.div>
                ) : isPlaying ? (
                  <Pause size={24} />
                ) : (
                  <Play size={24} className="ml-1" />
                )}
              </button>

              <button 
                onClick={() => nextHour && playHour(nextHour)}
                disabled={isLoading || isPlaying}
                className="hover:text-[var(--color-monastery-accent)] transition-colors disabled:opacity-50"
                title="Skip to next hour"
              >
                <SkipForward size={20} />
              </button>
            </div>

            {/* Prayer Text Display */}
            <div className="glass-panel p-8 rounded-2xl flex-grow flex flex-col">
              <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                <BookOpen size={14} /> Liturgy Text
              </h3>
              <div className="flex-grow overflow-y-auto max-h-[40vh] pr-2">
                <AnimatePresence mode="wait">
                  {prayerText ? (
                    <motion.div 
                      key="text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="font-serif text-lg leading-relaxed space-y-4 text-center markdown-body"
                    >
                      <Markdown>{prayerText}</Markdown>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex items-center justify-center opacity-30 font-serif italic"
                    >
                      The chapel is quiet.
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
                <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4">Daily Rhythm</h3>
                <div className="space-y-3">
                  {HOURS_SCHEDULE.map((h) => (
                    <div key={h.name} className={`flex justify-between items-center p-2 rounded ${currentHour?.name === h.name ? 'bg-[var(--color-monastery-accent)] text-black' : 'hover:bg-white/5'}`}>
                      <div>
                        <span className="font-serif font-bold mr-3">{h.name}</span>
                        <span className="text-xs opacity-70">{h.description}</span>
                      </div>
                      <span className="font-mono text-sm">{h.timeString}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>
    </div>
  );
}
