import { HourName, HOURS_SCHEDULE } from './hours';
import { FRAGMENTS_BY_HOUR, LiturgicalFragment } from './liturgicalFragments';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const ANGELUS_TIMES = ['06:00', '12:00', '18:00'] as const;

export const ANGELUS_FRAGMENT: LiturgicalFragment = {
  title: 'Ángelus',
  subtitle: 'María, Madre de Dios',
  text: `**V.** El Ángel del Señor anunció a María.
**R.** Y concibió por obra del Espíritu Santo.

**Ave María** (tres veces)

**V.** He aquí la esclava del Señor.
**R.** Hágase en mí según tu palabra.

**Ave María** (tres veces)

**V.** Y el Verbo se hizo carne.
**R.** Y habitó entre nosotros.

**Ave María** (tres veces)

**V.** Ruega por nosotros, Santa Madre de Dios.
**R.** Para que seamos dignos de alcanzar las promesas de Cristo.

**Oración:**
>Concédenos, Señor, la gracia del Espíritu Santo, para que, como el Verbo de la Encarnación lo anunció el Ángel a la Virgen María, por su intercesión y por su ejemplo aprendamos en la tierra a pronunciar tus alabanzas en el cielo. Por Jesucristo nuestro Señor. **Amén.**`,
};

export type GroupKind = 'hour' | 'angelus';

export interface PrayerGroup {
  id: string;
  label: string;
  timeString: string;
  kind: GroupKind;
  hour?: HourName;
  slotCount: number;
}

export interface PrayerSlot {
  id: string;
  groupLabel: string;
  groupKind: GroupKind;
  hour?: HourName;
  title: string;
  subtitle?: string;
  fragment: LiturgicalFragment;
  /** Index within FRAGMENTS_BY_HOUR when groupKind is hour */
  fragmentIndex: number;
  anchorTime: string;
}

const HOUR_ORDER: { hour: HourName; angelusBefore?: boolean }[] = [
  { hour: 'Maitines' },
  { hour: 'Laudes', angelusBefore: true },
  { hour: 'Tercia' },
  { hour: 'Sexta', angelusBefore: true },
  { hour: 'Nona' },
  { hour: 'Vísperas', angelusBefore: true },
  { hour: 'Completas' },
];

function hourTimeString(hour: HourName): string {
  return HOURS_SCHEDULE.find(h => h.name === hour)?.timeString ?? '00:00';
}

function buildDayPlaylist(): { groups: PrayerGroup[]; slots: PrayerSlot[] } {
  const groups: PrayerGroup[] = [];
  const slots: PrayerSlot[] = [];

  for (const { hour, angelusBefore } of HOUR_ORDER) {
    const anchor = hourTimeString(hour);

    if (angelusBefore) {
      const angelusTime = anchor;
      groups.push({
        id: `angelus-${angelusTime}`,
        label: 'Ángelus',
        timeString: angelusTime,
        kind: 'angelus',
        slotCount: 1,
      });
      slots.push({
        id: `angelus-${angelusTime}`,
        groupLabel: 'Ángelus',
        groupKind: 'angelus',
        title: ANGELUS_FRAGMENT.title,
        subtitle: ANGELUS_FRAGMENT.subtitle,
        fragment: ANGELUS_FRAGMENT,
        fragmentIndex: 0,
        anchorTime: angelusTime,
      });
    }

    const fragments = FRAGMENTS_BY_HOUR[hour];
    groups.push({
      id: hour,
      label: hour,
      timeString: anchor,
      kind: 'hour',
      hour,
      slotCount: fragments.length,
    });

    fragments.forEach((fragment, fragmentIndex) => {
      slots.push({
        id: `${hour}-${fragmentIndex}`,
        groupLabel: hour,
        groupKind: 'hour',
        hour,
        title: fragment.title,
        subtitle: fragment.subtitle,
        fragment,
        fragmentIndex,
        anchorTime: anchor,
      });
    });
  }

  return { groups, slots };
}

const { groups: DAY_GROUPS, slots: DAY_SLOTS } = buildDayPlaylist();

export { DAY_GROUPS, DAY_SLOTS };

export function getDayProgress(now: Date = new Date()): number {
  const ms =
    now.getHours() * 3_600_000 +
    now.getMinutes() * 60_000 +
    now.getSeconds() * 1_000 +
    now.getMilliseconds();
  return ms / DAY_MS;
}

export interface DayPosition {
  /** 0..1 progress through the liturgical day */
  progress: number;
  slotIndex: number;
  slot: PrayerSlot;
  slotProgress: number;
  msUntilNext: number;
  minutesUntilNext: number;
  nextSlot: PrayerSlot | null;
  groupIndex: number;
  group: PrayerGroup;
}

function findGroupIndex(slot: PrayerSlot): number {
  if (slot.groupKind === 'angelus') {
    return DAY_GROUPS.findIndex(g => g.kind === 'angelus' && g.timeString === slot.anchorTime);
  }
  return DAY_GROUPS.findIndex(g => g.kind === 'hour' && g.hour === slot.hour);
}

export function getDayPosition(now: Date = new Date()): DayPosition {
  const progress = getDayProgress(now);
  const n = DAY_SLOTS.length;
  const raw = progress * n;
  const slotIndex = Math.min(Math.floor(raw), n - 1);
  const slotProgress = raw - slotIndex;
  const slot = DAY_SLOTS[slotIndex];
  const nextSlot = DAY_SLOTS[(slotIndex + 1) % n] ?? null;
  const msPerSlot = DAY_MS / n;
  const msUntilNext = Math.max(0, Math.round((1 - slotProgress) * msPerSlot));

  return {
    progress,
    slotIndex,
    slot,
    slotProgress,
    msUntilNext,
    minutesUntilNext: Math.ceil(msUntilNext / 60_000),
    nextSlot,
    groupIndex: findGroupIndex(slot),
    group: DAY_GROUPS[findGroupIndex(slot)] ?? DAY_GROUPS[0],
  };
}

function slotsForGroup(group: PrayerGroup): PrayerSlot[] {
  if (group.kind === 'angelus') {
    return DAY_SLOTS.filter(s => s.groupKind === 'angelus' && s.anchorTime === group.timeString);
  }
  return DAY_SLOTS.filter(s => s.groupKind === 'hour' && s.hour === group.hour);
}

/** Titles for current + next liturgical group (fits one sidebar screen). */
export function getSidebarWheel(now: Date = new Date()) {
  const pos = getDayPosition(now);
  const currentGroup = DAY_GROUPS[pos.groupIndex];
  const nextGroup = DAY_GROUPS[(pos.groupIndex + 1) % DAY_GROUPS.length];
  const currentSlots = slotsForGroup(currentGroup);
  const nextSlots = slotsForGroup(nextGroup);
  const items = [
    ...currentSlots.map(slot => ({ slot, group: currentGroup, isNextGroup: false })),
    ...nextSlots.map(slot => ({ slot, group: nextGroup, isNextGroup: true })),
  ];
  const activeIndex = Math.max(0, items.findIndex(it => it.slot.id === pos.slot.id));
  return {
    currentGroup,
    nextGroup,
    items,
    activeIndex,
    slotProgress: pos.slotProgress,
    msUntilNext: pos.msUntilNext,
    nextTitle: pos.nextSlot?.title,
  };
}

export function getNearbySlots(now: Date = new Date(), before = 0, after = 2): PrayerSlot[] {
  const { slotIndex } = getDayPosition(now);
  const n = DAY_SLOTS.length;
  const result: PrayerSlot[] = [];
  for (let i = -before; i <= after; i++) {
    const idx = (slotIndex + i + n) % n;
    result.push(DAY_SLOTS[idx]);
  }
  return result;
}

export function getUpcomingGroups(now: Date = new Date(), count = 4): PrayerGroup[] {
  const { groupIndex } = getDayPosition(now);
  const result: PrayerGroup[] = [];
  for (let i = 0; i < count && i < DAY_GROUPS.length; i++) {
    result.push(DAY_GROUPS[(groupIndex + i) % DAY_GROUPS.length]);
  }
  return result;
}

export function isAngelusHour(h: number): boolean {
  return h === 6 || h === 12 || h === 18;
}

export function formatMinutesUntil(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  if (mins < 1) return 'menos de 1 min';
  if (mins === 1) return '1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
