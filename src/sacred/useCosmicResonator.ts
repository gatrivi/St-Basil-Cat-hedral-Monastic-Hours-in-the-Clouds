import { useRef, useEffect, useCallback } from 'react';
import { CosmicResonator } from './cosmic-resonator';

export function useCosmicResonator() {
  const resonatorRef = useRef<CosmicResonator | null>(null);

  const init = useCallback((soundEnabled = true) => {
    if (!resonatorRef.current) {
      resonatorRef.current = new CosmicResonator();
      // Lower base freq (65.41 is C2) and subtle volume
      resonatorRef.current.start({ baseFreq: 65.41, soundEnabled });
      resonatorRef.current.setWarmth(0.1);
    }
  }, []);

  const start = useCallback(() => {
    resonatorRef.current?.setActive(true);
  }, []);

  const stop = useCallback(() => {
    resonatorRef.current?.setActive(false);
  }, []);

  const setProgress = useCallback((progress: number) => {
    resonatorRef.current?.setSessionProgress(progress);
  }, []);

  const setWarmth = useCallback((warmth: number) => {
    resonatorRef.current?.setWarmth(warmth);
  }, []);

  const playChime = useCallback(() => {
    resonatorRef.current?.playActivationChime();
  }, []);

  const playBell = useCallback(() => {
    resonatorRef.current?.playBell();
  }, []);

  const cleanup = useCallback(() => {
    resonatorRef.current?.stop();
    resonatorRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { init, start, stop, setProgress, setWarmth, playChime, playBell, cleanup };
}
