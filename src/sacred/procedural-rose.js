/**
 * ═══════════════════════════════════════════════════════════════════════
 *  PROCEDURAL ROSE — Standalone Module
 *  Extracted from Rosario Cards v2 (Sacred Cosmic Edition)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Watermarks:
 *  • devtrivi  — Procedural rose path logic, warmth/wiggle algorithms
 *  • zengasoft — SVG rendering architecture, ink texture filters
 *
 *  License: Sacred Performance License v1.2
 *  Copyright (c) 2026 gatrivi. All Rights Reserved.
 *
 *  Dependencies: React (for JSX components)
 *
 *  Usage:
 *    import { RoseDrawing, SacredDrawing, SACRED_SYMBOLS } from './procedural-rose.js';
 *
 *    // Procedural rose that draws itself as progress increases (0 -> 1)
 *    <RoseDrawing progress={0.5} warmthProfile={[0.2,0.5,0.8]} seed={Date.now()} />
 *
 *    // Progressive sacred symbol (cross, crown, flame, etc.)
 *    <SacredDrawing symbolKey="cross" progress={0.5} />
 * ═══════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// ─── Sacred Symbols Data (zengasoft) ───
// ═══════════════════════════════════════════════════════════════════════

export const SACRED_SYMBOLS = {
  'cross': [
    'M 50,20 L 50,110',
    'M 30,45 L 70,45'
  ],
  'praying_hands': [
    'M 50,105 q -20,-20 -20,-55 q 0,-30 20,-40',
    'M 50,105 q 20,-20 20,-55 q 0,-30 -20,-40',
    'M 40,90 q 10,5 20,0'
  ],
  'scroll': [
    'M 30,25 q 20,-5 40,0 L 70,115 q -20,5 -40,0 Z',
    'M 30,25 q -10,0 -10,10 v 5',
    'M 70,115 q 10,0 10,-10 v -5'
  ],
  'crown': [
    'M 25,75 L 20,50 L 40,65 L 50,40 L 60,65 L 80,50 L 75,75 Z',
    'M 25,80 q 25,5 50,0'
  ],
  'flame': [
    'M 50,115 q -30,-40 -15,-80 q 15,-40 15,0',
    'M 50,115 q 30,-40 15,-80 q -15,-40 -15,0',
    'M 50,95 v -30'
  ],
  'gozoso_1': [
    'M 50,100 L 50,60',
    'M 35,45 q 15,-15 30,0',
    'M 50,60 q -20,-10 -20,10 q 0,20 20,0',
    'M 50,60 q 20,-10 20,10 q 0,20 -20,0'
  ],
  'gozoso_2': [
    'M 35,40 q -10,10 0,60 q 10,20 15,0',
    'M 65,40 q 10,10 0,60 q -10,20 -15,0',
    'M 40,75 q 10,5 20,0'
  ],
  'gozoso_3': [
    'M 50,10 q 0,20 0,0 M 40,20 l 20,0 M 50,10 l 0,20',
    'M 30,80 h 40 v 20 h -40 Z',
    'M 35,80 q 15,-15 30,0'
  ],
  'gozoso_4': [
    'M 30,110 v -20 q 20,-20 40,0 v 20',
    'M 50,100 v -40',
    'M 50,55 q 5,-10 0,-15 q -5,5 0,15'
  ],
  'gozoso_5': [
    'M 50,100 V 50',
    'M 50,50 q 20,-10 30,10 v 40 q -10,-10 -30,0',
    'M 50,50 q -20,-10 -30,10 v 40 q 10,-10 30,0'
  ],
  'doloroso_1': [
    'M 40,110 h 20 l -5,-40 h -10 Z',
    'M 35,70 q 15,10 30,0',
    'M 50,50 q -15,-20 0,-40 q 15,20 0,40'
  ],
  'doloroso_2': [
    'M 40,110 V 30 h 20 v 80 Z',
    'M 35,50 q 30,5 30,10 M 35,70 q 30,5 30,10'
  ],
  'doloroso_3': [
    'M 50,70 m -30,0 a 30,15 0 1,0 60,0 a 30,15 0 1,0 -60,0',
    'M 30,60 l -5,-10 M 70,60 l 5,-10 M 50,55 l 0,-10'
  ],
  'doloroso_4': [
    'M 30,110 L 70,30',
    'M 20,40 L 60,60'
  ],
  'doloroso_5': [
    'M 30,50 L 50,90', 'M 70,50 L 50,90',
    'M 50,90 V 110',
    'M 25,48 h 10 M 65,48 h 10 M 47,110 h 6'
  ],
  'glorioso_1': [
    'M 50,110 V 30',
    'M 50,35 q 20,0 20,15 q -20,15 -20,0',
    'M 50,80 m -20,0 a 20,20 0 1,0 40,0 a 20,20 0 1,0 -40,0'
  ],
  'glorioso_2': [
    'M 30,90 q 10,-15 20,0 q 10,-15 20,0 q 10,-15 20,0 h -60',
    'M 50,70 V 30 L 45,40 M 50,30 L 55,40'
  ],
  'glorioso_3': [
    'M 50,110 q -10,-20 0,-40 q 10,20 0,40',
    'M 50,40 q -20,-10 -30,10 M 50,40 q 20,-10 30,10',
    'M 50,40 q 0,10 5,0'
  ],
  'glorioso_4': [
    'M 50,110 q -40,-20 0,-80 M 50,110 q 40,-20 0,-80',
    'M 50,30 q -10,0 -10,15 q 0,15 10,15 q 10,0 10,-15 q 0,-15 -10,-15'
  ],
  'glorioso_5': [
    'M 25,75 L 20,50 L 40,65 L 50,40 L 60,65 L 80,50 L 75,75 Z',
    'M 50,30 m -35,0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0'
  ],
  'luminoso_1': [
    'M 30,40 q 20,-10 40,0 q 10,40 -20,60 q -30,-20 -20,-60',
    'M 50,100 v 20 M 45,105 v 10 M 55,105 v 10'
  ],
  'luminoso_2': [
    'M 40,40 h 20 l 10,60 q 0,20 -20,20 q -20,0 -20,-20 Z',
    'M 70,100 q 15,-5 20,-20'
  ],
  'luminoso_3': [
    'M 40,40 h 20 v 60 M 35,100 h 30',
    'M 40,40 q 0,-15 10,-15 q 10,0 10,15',
    'M 60,80 h 10 v 5 M 60,90 h 10 v 5'
  ],
  'luminoso_4': [
    'M 50,70 m -20,0 a 20,20 0 1,0 40,0 a 20,20 0 1,0 -40,0',
    'M 50,30 v -15 M 50,110 v 15 M 20,70 h -15 M 80,70 h 15',
    'M 30,40 L 20,30 M 70,40 L 80,30'
  ],
  'luminoso_5': [
    'M 40,110 h 20 l -5,-40 h -10 Z',
    'M 35,70 q 15,10 30,0',
    'M 40,30 q 10,-10 20,0 q 10,10 -10,20 q -20,-10 -10,-20'
  ]
};

export const SYMBOL_MAP = {
  'SC': 'cross', 'P': 'cross', 'AC': 'praying_hands',
  'C': 'scroll', 'G': 'crown', 'F': 'flame', 'LL': 'crown', 'S': 'crown'
};

// ═══════════════════════════════════════════════════════════════════════
// ─── Celestial Color Helpers (devtrivi) ───
// ═══════════════════════════════════════════════════════════════════════

const getCelestialShift = () => {
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 22) return { shift: [10, 10, 40], name: 'Moonlight' };
  if (hour < 9) return { shift: [0, 10, -20], name: 'Dawn' };
  if (hour >= 18) return { shift: [40, -10, -40], name: 'Sunset' };
  return { shift: [0, 0, 0], name: 'High Noon' };
};

const toRGB = (c, shift = [0,0,0]) =>
  `rgb(${Math.max(0, Math.min(255, c[0] + shift[0]))}, ${Math.max(0, Math.min(255, c[1] + shift[1]))}, ${Math.max(0, Math.min(255, c[2] + shift[2]))})`;

// ═══════════════════════════════════════════════════════════════════════
// ─── RoseDrawing — SVG Rose that draws itself progressively (devtrivi) ───
// ═══════════════════════════════════════════════════════════════════════

const ROSE_PATHS = [
  'M 50,42 c 2,-3 5,-3 5,0 c 0,3 -3,5 -5,3',
  'M 50,45 c -3,1 -7,-1 -7,-4 c 0,-3 3,-6 7,-5',
  'M 35,31 c 1,-10 9,-18 19,-19 c 10,-1 19,5 23,14',
  'M 77,26 c 5,7 5,18 1,25 c -4,7 -13,12 -21,10',
  'M 53,56 c -7,3 -16,1 -20,-5 c -4,-6 -3,-15 2,-20',
  'M 50,36 c 4,-1 9,2 9,7 c 0,5 -4,8 -8,8',
  'M 42,33 c 1,-6 7,-12 14,-11 c 7,1 12,6 14,11',
  'M 51,51 c -5,2 -12,0 -14,-5 c -2,-5 1,-10 5,-13',
  'M 70,33 c 3,5 2,13 -2,17 c -4,4 -10,6 -15,5',
  'M 50,59 c 0,10 -1,22 0,34 c 1,12 0,24 0,36',
  'M 51,80 c 6,-5 15,-4 17,1 c 2,5 -3,8 -10,5',
  'M 49,100 c -6,-5 -15,-4 -17,1 c -2,5 3,8 10,5',
];

const PATH_TYPES = [
  'petal','petal','petal','petal','petal','petal','petal','petal','petal',
  'stem','leaf','leaf'
];

const ROSE_COLORS = {
  coolRed:     'rgb(110, 20, 30)',
  baseRed:     'rgb(170, 15, 25)',
  warmRed:     'rgb(220, 10, 30)',
  brightRed:   'rgb(255, 30, 50)',
  incandescent:'rgb(255, 120, 120)',
  stem:        '#2d5a27',
  leaf:        '#3e8e2c',
};

const DASH = 500;

function petalColor(warmth, seed = 0) {
  let base;
  if (warmth < 0.10) base = ROSE_COLORS.coolRed;
  else if (warmth < 0.25) base = ROSE_COLORS.baseRed;
  else if (warmth < 0.50) base = ROSE_COLORS.warmRed;
  else if (warmth < 0.75) base = ROSE_COLORS.brightRed;
  else base = ROSE_COLORS.incandescent;

  if (!seed) return base;
  const shift = (seed % 24) - 12;
  const rgb = base.match(/\d+/g).map(Number);
  return `rgb(${Math.max(0, Math.min(255, rgb[0] + shift))}, ${Math.max(0, Math.min(255, rgb[1] - shift/2))}, ${Math.max(0, Math.min(255, rgb[2] - shift/2))})`;
}

export function RoseDrawing({
  progress = 0,
  warmthProfile = [],
  wiggleProfile = [],
  enrichment = 0,
  liveWarmth = null,
  seed = 0,
  size = 120,
  compact = false,
  style = {},
  onClick,
}) {
  const N_TOTAL = ROSE_PATHS.length;
  const N_RENDER = compact ? 9 : N_TOTAL;

  const pathsRef = useRef([]);
  const [pathLengths, setPathLengths] = useState(Array(N_TOTAL).fill(DASH));

  useEffect(() => {
    if (pathsRef.current) {
      const lengths = pathsRef.current.map((p) => p ? p.getTotalLength() : DASH);
      setPathLengths(lengths);
    }
  }, []);

  const sVal = seed || 0;

  return (
    <svg
      viewBox={compact ? "15 14 70 48" : "0 0 100 140"}
      width={size}
      height={compact ? size * 0.68 : size * 1.4}
      style={{ overflow: 'visible', ...style }}
      onClick={onClick}
    >
      <defs>
        <filter id={`rose-texture-${sVal}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={1 + (sVal % 3)} />
        </filter>
        <filter id={`rose-glow-${sVal}`}>
          <feGaussianBlur stdDeviation={1 + (sVal % 2)} />
        </filter>
      </defs>

      {ROSE_PATHS.slice(0, N_RENDER).map((d, i) => {
        const start = i / N_RENDER;
        const end   = (i + 1) / N_RENDER;
        const seg   = Math.max(0, Math.min(1, (progress - start) / (end - start)));

        const pathLen = pathLengths[i];
        const offset = pathLen * (1 - seg);
        const type = PATH_TYPES[i];

        const isActive = progress >= start && progress < end;

        const w = (isActive && liveWarmth !== null)
                    ? Math.max(0.1, liveWarmth)
                    : (warmthProfile[i] !== undefined ? warmthProfile[i] : 0.2);

        const stroke = type === 'stem'  ? ROSE_COLORS.stem
                     : type === 'leaf'  ? ROSE_COLORS.leaf
                     : petalColor(w, sVal);

        const wig = (wiggleProfile[i] || 0) + (sVal ? (sVal % 5) * 0.05 : 0);
        let transform;
        if (wig > 0.1) {
          const pSeed = i * 17 + (sVal % 100);
          const rot = ((pSeed % 11) - 5.5) * wig * 0.8;
          const tx  = ((pSeed % 7) - 3.5) * wig * 0.3;
          const ty  = (((pSeed * 3) % 7) - 3.5) * wig * 0.3;
          transform = `rotate(${rot.toFixed(2)}, 50, 42) translate(${tx.toFixed(2)}, ${ty.toFixed(2)})`;
        }

        const sw = type === 'stem' ? 1.8 : type === 'leaf' ? 1.4 : 1.6;

        return (
          <g key={i} transform={transform} style={{ opacity: seg <= 0 ? 0 : 1, transition: 'opacity 0.1s linear' }}>
            {enrichment > 0.1 && type === 'petal' && (
              <path
                d={d} fill="none"
                stroke={stroke}
                strokeWidth={sw + 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLen}
                strokeDashoffset={offset}
                opacity={enrichment * 0.2}
                filter={`url(#rose-glow-${sVal})`}
              />
            )}
            <path
              ref={(el) => (pathsRef.current[i] = el)}
              d={d} fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={pathLen}
              strokeDashoffset={offset}
              filter={`url(#rose-texture-${sVal})`}
              style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.5s ease' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

RoseDrawing.PATH_COUNT = ROSE_PATHS.length;

// ═══════════════════════════════════════════════════════════════════════
// ─── SacredDrawing — Generic progressive SVG symbol (zengasoft) ───
// ═══════════════════════════════════════════════════════════════════════

const SACRED_COLORS = {
  silver:   [185, 185, 195],
  gold:     [212, 175, 55],
  amber:    [210, 140, 10],
  incand:   [245, 215, 160],
};

function getDrawingColor(warmth, shift) {
  if (warmth < 0.2) return toRGB(SACRED_COLORS.silver, shift);
  if (warmth < 0.5) return toRGB(SACRED_COLORS.gold, shift);
  if (warmth < 0.8) return toRGB(SACRED_COLORS.amber, shift);
  return toRGB(SACRED_COLORS.incand, shift);
}

export function SacredDrawing({
  symbolKey = 'cross',
  progress = 0,
  warmthProfile = [],
  wiggleProfile = [],
  enrichment = 0,
  liveWarmth = null,
  baseColor = '#D4AF37',
  style = {},
  size = 100,
  decadeIndex = 0,
}) {
  const paths = SACRED_SYMBOLS[symbolKey] || SACRED_SYMBOLS.cross;
  const N = paths.length;

  const pathsRef = useRef([]);
  const [pathLengths, setPathLengths] = useState(Array(N).fill(DASH));

  useEffect(() => {
    if (pathsRef.current) {
      const lengths = pathsRef.current.map((p) => (p ? p.getTotalLength() : DASH));
      setPathLengths(lengths);
    }
  }, [symbolKey]);

  const bloomScale = 1 + (decadeIndex * 0.015);

  return (
    <svg
      viewBox="0 0 100 140"
      width={size}
      height={size * 1.4}
      style={{ overflow: 'visible', ...style }}
    >
      <defs>
        <filter id="sacred-ink-texture">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={2} />
        </filter>
        <filter id="sacred-glow">
          <feGaussianBlur stdDeviation={1.5} />
        </filter>
      </defs>

      <g transform={`scale(${bloomScale})`} transformOrigin="50 70">
      {paths.map((d, i) => {
        const start = i / N;
        const end = (i + 1) / N;
        const seg = Math.max(0, Math.min(1, (progress - start) / (end - start)));

        const pathLen = pathLengths[i] || DASH;
        const offset = pathLen * (1 - seg);
        const isActive = progress >= start && progress < end;

        const w = (isActive && liveWarmth !== null)
          ? Math.max(0.1, liveWarmth)
          : (warmthProfile[i] !== undefined ? warmthProfile[i] : 0.2);

        const { shift } = getCelestialShift();
        const strokeColor = baseColor || getDrawingColor(w, shift);

        const wig = wiggleProfile[i] || 0;
        let transform;
        if (wig > 0.3) {
          const seed = i * 13 + 3;
          const rot = ((seed % 7) - 3.5) * wig * 0.5;
          const tx = ((seed % 5) - 2.5) * wig * 0.2;
          const ty = (((seed * 2) % 5) - 2.5) * wig * 0.2;
          transform = `rotate(${rot.toFixed(1)}, 50, 70) translate(${tx.toFixed(1)}, ${ty.toFixed(1)})`;
        }

        const strokeSeed = i * 17 + Math.floor(progress * 100);
        const livingStrokeWidth = (1.5 + (strokeSeed % 7) * 0.1) * (1 + enrichment * 0.3);
        const livingOpacity = 0.85 + (strokeSeed % 5) * 0.03;

        return (
          <g key={i} transform={transform} style={{
            opacity: seg <= 0 ? 0 : livingOpacity,
            transition: 'opacity 0.2s linear'
          }}>
            {enrichment > 0.1 && (
              <path
                d={d} fill="none"
                stroke={strokeColor}
                strokeWidth={3 + enrichment * 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLen}
                strokeDashoffset={offset}
                opacity={enrichment * 0.15}
                filter="url(#sacred-glow)"
              />
            )}
            <path
              ref={(el) => (pathsRef.current[i] = el)}
              d={d} fill="none"
              stroke={strokeColor}
              strokeWidth={livingStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={pathLen}
              strokeDashoffset={offset}
              filter="url(#sacred-ink-texture)"
              style={{
                transition: 'stroke-dashoffset 0.12s linear, stroke 0.4s ease, stroke-width 0.3s ease',
              }}
            />
          </g>
        );
      })}
      </g>
    </svg>
  );
}
