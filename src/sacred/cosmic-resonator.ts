/**
 * ═══════════════════════════════════════════════════════════════════════
 *  COSMIC RESONATOR — Standalone Module
 *  Extracted from Rosario Cards v2 (Sacred Cosmic Edition)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Watermarks:
 *  • devtrivi  — Original cosmic modulation algorithms
 *  • zengasoft — Gothic organ synthesis architecture
 *
 *  License: Sacred Performance License v1.2
 *  Copyright (c) 2026 gatrivi. All Rights Reserved.
 *
 *  Usage: import { CosmicResonator } from './cosmic-resonator.js';
 *         const resonator = new CosmicResonator();
 *         resonator.start({ baseFreq: 164.81, soundEnabled: true });
 *         resonator.setActive(true);  // user is interacting
 *         resonator.setWarmth(0.5);   // 0-1 warmth level
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Astronomy Engine (devtrivi) ───
const J2000 = 946728000000; // Jan 1, 2000 12:00:00 UTC
const YEAR_MS = 31557600000;

const PERIODS = {
  mercury: 0.2408,
  venus:   0.6152,
  earth:   1.0000,
  mars:    1.8808,
  jupiter: 11.8618,
  saturn:  29.4571,
  uranus:  84.0110,
  neptune: 164.7913,
  pluto:   247.9400
};

export interface CosmicPhases {
  daily: number;
  weekly: number;
  hourly: number;
  isSacredWindow: boolean;
  [planet: string]: number | boolean;
}

export function getCosmicPhases(dateInput = Date.now()): CosmicPhases {
  const elapsed = dateInput - J2000;
  const elapsedY = elapsed / YEAR_MS;

  const phases: Record<string, number> = {};
  Object.keys(PERIODS).forEach(planet => {
    const period = (PERIODS as Record<string, number>)[planet];
    const offset = (Object.keys(PERIODS).indexOf(planet) * 0.13);
    const raw = Math.sin((elapsedY / period) * 2 * Math.PI + offset);
    phases[planet] = (raw + 1) / 2;
  });

  const daily  = (dateInput % (24 * 3600 * 1000)) / (24 * 3600 * 1000);
  const weekly = (dateInput % (7 * 24 * 3600 * 1000)) / (7 * 24 * 3600 * 1000);
  const hourly = (dateInput % (3600 * 1000)) / (3600 * 1000);

  return {
    ...phases,
    daily,
    weekly,
    hourly,
    isSacredWindow: phases.jupiter > 0.8 && phases.earth > 0.4
  };
}

export function getCosmicSeed() {
  const today = new Date().setHours(0, 0, 0, 0);
  const phases = getCosmicPhases(today);
  return Math.floor((phases.jupiter as number) * 10000 + (phases.saturn as number) * 1000);
}

// ─── Audio Manager (zengasoft) ───
class AudioManager {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  init(): AudioContext | null {
    if (this.isInitialized) return this.ctx;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.isInitialized = true;

    if (this.ctx.state === 'suspended') {
      const resume = () => {
        this.ctx!.resume().then(() => {
          window.removeEventListener('click', resume);
          window.removeEventListener('touchstart', resume);
          window.removeEventListener('keydown', resume);
        });
      };
      window.addEventListener('click', resume);
      window.addEventListener('touchstart', resume);
      window.addEventListener('keydown', resume);
    }
    return this.ctx;
  }

  getContext(): AudioContext | null {
    if (!this.isInitialized) return this.init();
    return this.ctx;
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}

const audioManager = new AudioManager();

// ─── Cosmic Resonator (devtrivi + zengasoft) ───
interface SynthNodes {
  osc: OscillatorNode;
  osc2: OscillatorNode;
  osc3: OscillatorNode;
  osc4: OscillatorNode;
  celestialGain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
  gainNode: GainNode;
  padGain: GainNode;
}

export class CosmicResonator {
  private ctx: AudioContext | null = null;
  private synth: SynthNodes | null = null;
  private soundEnabled = true;
  private baseFreq = 164.81;
  private warmth = 0;
  private sessionProgress = 0;
  private totalEnrichment = 0;
  private lfoSpeed = 0.2;
  private _raf: number | null = null;

  constructor() {}

  start({ baseFreq = 164.81, soundEnabled = true }: { baseFreq?: number; soundEnabled?: boolean } = {}) {
    this.baseFreq = baseFreq;
    this.soundEnabled = soundEnabled;
    this.ctx = audioManager.getContext();
    if (!this.ctx) return;

    if (!this.soundEnabled) this.ctx.suspend();

    const ctx = this.ctx;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(ctx.destination);

    // --- Gothic Organ Timbre (zengasoft architecture) ---
    // Osc1: Sine (Foundational Root)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);

    // Osc2: Triangle (Perfect 5th — reed texture)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);

    // Osc3: Sine (Octave below — depth)
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(baseFreq * 0.5, ctx.currentTime);

    // Osc4: Sine (2 Octaves up — Celestial shimmer)
    const osc4 = ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(baseFreq * 4, ctx.currentTime);
    const celestialGain = ctx.createGain();
    celestialGain.gain.value = 0;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.005; // Lower initial pad

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 1;

    // LFO "breath" (devtrivi modulation target)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = this.lfoSpeed;
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    osc.connect(filter);
    osc2.connect(filter);
    osc3.connect(padGain);
    osc4.connect(celestialGain);
    celestialGain.connect(filter);
    padGain.connect(filter);
    filter.connect(gainNode);

    osc.start();
    osc2.start();
    osc3.start();
    osc4.start();

    this.synth = { osc, osc2, osc3, osc4, celestialGain, lfo, lfoGain, filter, gainNode, padGain };

    // Start the cosmic modulation loop
    this._tick();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.synth) {
      const { osc, osc2, osc3, osc4, lfo, gainNode } = this.synth;
      try {
        osc.stop(); osc2.stop(); osc3.stop(); osc4.stop(); lfo.stop();
        gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      } catch (e) { /* ignore */ }
    }
    this.synth = null;
  }

  setActive(active) {
    if (!this.synth || !this.soundEnabled) return;
    const { gainNode } = this.synth;
    if (active) {
      this._tick();
    } else {
      gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
  }

  setWarmth(warmth) {
    this.warmth = Math.max(0, Math.min(1, warmth));
  }

  setSessionProgress(progress) {
    this.sessionProgress = Math.max(0, Math.min(1, progress));
  }

  setTotalEnrichment(enrichment) {
    this.totalEnrichment = Math.max(0, Math.min(1, enrichment));
  }

  setBaseFreq(freq) {
    this.baseFreq = freq;
    if (!this.synth) return;
    const t = this.ctx.currentTime;
    this.synth.osc.frequency.setTargetAtTime(freq, t, 0.1);
    this.synth.osc2.frequency.setTargetAtTime(freq * 1.5, t, 0.1);
    this.synth.osc3.frequency.setTargetAtTime(freq * 0.5, t, 0.1);
    this.synth.osc4.frequency.setTargetAtTime(freq * 4, t, 0.1);
  }

  // ─── One-shot chimes ───
  playActivationChime(baseFreq?: number) {
    if (!this.soundEnabled || !this.ctx) return;
    const ctx = this.ctx;
    const base = baseFreq ?? this.baseFreq;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 2, ctx.currentTime);
    osc.frequency.setValueAtTime(base * 2.5, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  playBell(baseFreq?: number) {
    if (!this.soundEnabled || !this.ctx) return;
    const ctx = this.ctx;
    const base = (baseFreq ?? this.baseFreq) * 0.5;
    const freqs = [base, base * 2.01, base * 3.02, base * 4.03];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = (i === 0) ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04 - (i * 0.01), ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.0);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 4.1);
    });
  }

  playChord(baseFreq?: number) {
    if (!this.soundEnabled || !this.ctx) return;
    const ctx = this.ctx;
    const base = baseFreq ?? this.baseFreq;
    [base, base * 1.25, base * 1.5, base * 2].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 2, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04 - i * 0.005, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    });
  }

  // ─── Internal cosmic modulation loop (devtrivi) ───
  private _tick() {
    if (!this.synth || !this.soundEnabled) return;

    const { filter, gainNode, padGain, celestialGain, lfoGain, lfo } = this.synth;
    const t = this.ctx.currentTime;

    // --- Cosmic Modulation (The Great Journey) ---
    const cosmic = getCosmicPhases();

    // Saturn (29y) & Pluto (248y) affect the Ground
    const deepBase = (cosmic.pluto as number) * 10 + (cosmic.saturn as number) * 5;

    // Mercury (7d) affects LFO speed (The Breath)
    const lfoSpeed = 0.15 + ((cosmic.mercury as number) * 0.1);
    if (lfo) lfo.frequency.setTargetAtTime(lfoSpeed, t, 1.0);

    // Jupiter modulates Seasonal Cutoff
    const jupiterMod = (cosmic.jupiter as number) * 150;
    const targetFreq = 400 + this.warmth * 300 + this.sessionProgress * 400 + this.totalEnrichment * 200 + jupiterMod + deepBase;
    filter.frequency.setTargetAtTime(targetFreq, t, 0.5);

    // Neptune (164y) modulates ethereal wash (Resonance)
    filter.Q.setTargetAtTime(1 + this.sessionProgress * 2 + (cosmic.neptune as number) * 1.5, t, 0.5);

    // Uranus (84y) modulates shimmer depth
    celestialGain.gain.setTargetAtTime(this.sessionProgress * 0.015 + ((cosmic.uranus as number) * 0.005), t, 1.0);

    // LFO Shimmer grows as prayer deepens
    lfoGain.gain.setTargetAtTime(this.sessionProgress * 50 + ((cosmic.mercury as number) * 20), t, 1.0);

    // Volume: constant low gain
    const baseVolume = 0.005 + (this.totalEnrichment * 0.002);
    gainNode.gain.setTargetAtTime(baseVolume + this.warmth * 0.002, t, 0.5);

    // Pad stability
    padGain.gain.setTargetAtTime(0.004 + this.totalEnrichment * 0.005, t, 0.5);

    this._raf = requestAnimationFrame(() => this._tick());
  }
}

// Convenience default export
export default CosmicResonator;
