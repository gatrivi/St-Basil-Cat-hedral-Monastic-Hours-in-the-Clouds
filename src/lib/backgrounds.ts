import { useState, useEffect, useRef, useCallback } from 'react';
import { BACKGROUND_IMAGES } from './backgroundManifest';
import { HourName } from './hours';

const ALL_BACKGROUNDS = [...BACKGROUND_IMAGES];

/*
  Keywords that steer the random picker toward thematically
  appropriate images for each liturgical hour.
  A match multiplies the selection weight so those images
  appear far more often, but the general pool still bleeds
  in for variety.
*/
const HOUR_KEYWORDS: Record<HourName, string[]> = {
  Maitines: [
    'maitines', 'noche', 'night', 'angel', 'angel', 'michael', 'miguel',
    'serafin', 'seraph', 'stained', 'glass', 'vitra', 'gethsemane',
    'huerto', 'garden', 'prayer', 'oracion', 'oración', 'watch',
    'vigilia', 'dark', 'oscuro', 'oscure', 'moon', 'luna', 'star',
    'estrella', 'midnight', 'medianoche', 'loreto', 'loretto',
    'catacomb', 'catacumba', 'silent', 'silencio', 'weep', 'llor',
  ],
  Laudes: [
    'laudes', 'dawn', 'amanecer', 'morning', 'mañana', 'resurrec',
    'resur', 'anuncia', 'bautism', 'baptis', 'baptiz', 'ascens',
    'ascend', 'gozo', 'joy', 'joyful', 'simeon', 'benedictus',
    'luz', 'light', 'sun', 'sol', 'meet', 'encuentro', 'elisabeth',
    'visitac', 'presentac', 'natividad', 'navidad', 'christmas',
    'nacim', 'birth', 'saviour', 'salvador', 'rise', 'rising',
  ],
  Tercia: [
    'tercia', 'pentecost', 'pente', 'luminoso', 'luminous',
    'transfig', 'transfigur', 'cana', 'caná', 'boda', 'wedding',
    'marriage', 'sermon', 'monte', 'mount', 'templo', 'temple',
    'doctor', 'doctore', 'teach', 'enseñ', 'instruction', 'school',
    'escuela', 'truth', 'verdad', 'flame', 'fuego', 'fire',
    'espiritu', 'espíritu', 'spirit', 'holy', 'santo',
  ],
  Sexta: [
    'sexta', 'crucif', 'cruz', 'cross', 'crucifix', 'dolor', 'sorrow',
    'pain', 'suff', 'thorn', 'espina', 'spine', 'flagel', 'scourg',
    'whip', 'calvar', 'calvary', 'golgotha', 'falling', 'caida',
    'caída', 'passion', 'pasion', 'pasión', 'midday', 'mediodia',
    'mediodía', 'noon', 'twelve', 'blood', 'sangre', 'wound', 'herida',
    'crown', 'corona', 'elevation', 'elevacion', 'elevación', 'nail',
    'clavo', 'spear', 'lanza',
  ],
  Nona: [
    'nona', 'entomb', 'sepulcr', 'burial', 'bury', 'tomb', 'sepulcro',
    'dead', 'death', 'muert', 'die', 'pieta', 'piedad', 'mourn',
    'luto', 'grief', 'deposition', 'taking', 'descend', 'descenso',
    'evening', 'tarde', 'afternoon', 'three', 'tres', 'shadow',
    'sombra', 'last', 'ultima', 'última', 'supper', 'cena',
  ],
  Vísperas: [
    'visperas', 'vísperas', 'vesper', 'asuncion', 'asunción', 'assumpt',
    'coron', 'crown', 'crowning', 'glor', 'glory', 'glorious',
    'triumph', 'triunfo', 'victor', 'queen', 'reina', 'royal', 'real',
    'majesty', 'majestad', 'virgin', 'virgen', 'maria', 'maría', 'mary',
    'madonna', 'mother', 'madre', 'heaven', 'cielo', 'celestial',
    'sunset', 'atardecer', 'dusk', 'twilight', 'golden', 'dorado',
    'maratta', 'veronese', 'velazquez', 'velázquez',
  ],
  Completas: [
    'completas', 'nativ', 'nativity', 'nacim', 'birth', 'noche', 'night',
    'sleep', 'descans', 'rest', 'dream', 'sueño', 'peace', 'paz',
    'quiet', 'quietud', 'guardian', 'guarda', 'protect', 'protec',
    'sacred', 'sagrado', 'heart', 'corazon', 'corazón', 'salve',
    'sign', 'señal', 'blessing', 'bendic', 'home', 'hogar', 'family',
    'familia', 'infant', 'child', 'niño', 'baby', 'bebe', 'cuna',
    'manger', 'pesebre', 'inn', 'posada', 'shepherd', 'pastor',
    'star', 'estrella', 'stable', 'establo',
  ],
};

function buildWeights(hour: HourName): number[] {
  const keywords = HOUR_KEYWORDS[hour];
  return ALL_BACKGROUNDS.map(src => {
    const lower = src.toLowerCase();
    const match = keywords.some(kw => lower.includes(kw));
    return match ? 8 : 1;
  });
}

function pickWeightedRandom(weights: number[], excludeIndex: number): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    if (i !== excludeIndex) total += weights[i];
  }
  let random = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (i === excludeIndex) continue;
    random -= weights[i];
    if (random <= 0) return i;
  }
  // fallback
  const next = (excludeIndex + 1) % weights.length;
  return next;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function useBackground(currentHour: HourName | null) {
  const [currentSrc, setCurrentSrc] = useState(ALL_BACKGROUNDS[0] || '');
  const [previousSrc, setPreviousSrc] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const indexRef = useRef(0);
  const lastHourRef = useRef<HourName | null>(null);
  const lastRotationRef = useRef<number>(Date.now());
  const weightsRef = useRef<number[]>([]);

  // Rebuild weights when hour changes
  useEffect(() => {
    if (currentHour) {
      weightsRef.current = buildWeights(currentHour);
    }
  }, [currentHour]);

  const rotate = useCallback(() => {
    const weights = weightsRef.current;
    if (weights.length === 0) return;

    const nextIdx = pickWeightedRandom(weights, indexRef.current);
    const nextSrc = ALL_BACKGROUNDS[nextIdx];
    if (!nextSrc || nextSrc === currentSrc) return;

    preloadImage(nextSrc).then(() => {
      setPreviousSrc(currentSrc);
      setCurrentSrc(nextSrc);
      setIsTransitioning(true);
      indexRef.current = nextIdx;
      lastRotationRef.current = Date.now();

      setTimeout(() => {
        setIsTransitioning(false);
        setPreviousSrc('');
      }, 2500);
    });
  }, [currentSrc]);

  // Rotate when hour changes
  useEffect(() => {
    if (!currentHour) return;
    if (lastHourRef.current !== currentHour) {
      lastHourRef.current = currentHour;
      rotate();
    }
  }, [currentHour, rotate]);

  // Occasional subtle rotation every ~20 min if same hour
  useEffect(() => {
    const timer = setInterval(() => {
      const sinceRotation = Date.now() - lastRotationRef.current;
      if (sinceRotation > 20 * 60 * 1000) {
        rotate();
      }
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [rotate]);

  return { currentSrc, previousSrc, isTransitioning };
}
