import { HourName, HOURS_SCHEDULE } from './hours';
import { FRAGMENTS_BY_HOUR, LiturgicalFragment } from './liturgicalFragments';

export type OfficeByHour = Record<HourName, LiturgicalFragment[]>;

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
  /** Index within the hour's fragment list when groupKind is hour */
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

function fragmentsForHour(hour: HourName, office?: OfficeByHour | null): LiturgicalFragment[] {
  const live = office?.[hour];
  if (live && live.length > 0) return live;
  return FRAGMENTS_BY_HOUR[hour];
}

export function buildDayPlaylist(office?: OfficeByHour | null): {
  groups: PrayerGroup[];
  slots: PrayerSlot[];
} {
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

    const fragments = fragmentsForHour(hour, office);
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

const fallback = buildDayPlaylist(null);

let activeGroups = fallback.groups;
let activeSlots = fallback.slots;
let officeSource: 'fallback' | 'live' = 'fallback';
let officeLabel = 'Salterio local';

export function getDayGroups(): PrayerGroup[] {
  return activeGroups;
}
export function getDaySlots(): PrayerSlot[] {
  return activeSlots;
}

/** Snapshot at module load (static fallback). Prefer getDaySlots() after live office loads. */
export const DAY_GROUPS = fallback.groups;
export const DAY_SLOTS = fallback.slots;

export function getOfficeMeta() {
  return { source: officeSource, label: officeLabel, slotCount: activeSlots.length };
}

export function setOfficePlaylist(office: OfficeByHour | null, label?: string): void {
  const built = buildDayPlaylist(office);
  activeGroups = built.groups;
  activeSlots = built.slots;
  officeSource = office ? 'live' : 'fallback';
  officeLabel = label ?? (office ? 'Oficio del día' : 'Salterio local');
}

/** Ángelus shares the hour’s clock mark; keep a short lead-in before Laudes/Sexta/Vísperas. */
const ANGELUS_WINDOW_MS = 3 * 60_000;

export function getDayProgress(now: Date = new Date()): number {
  const ms =
    now.getHours() * 3_600_000 +
    now.getMinutes() * 60_000 +
    now.getSeconds() * 1_000 +
    now.getMilliseconds();
  return ms / DAY_MS;
}

function parseTimeToMs(timeString: string): number {
  const [h, m] = timeString.split(':').map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60_000;
}

interface GroupWindow {
  group: PrayerGroup;
  startMs: number;
  endMs: number;
}

/** Map each playlist group onto its clock window (hour → next hour). */
export function buildGroupWindows(groups: PrayerGroup[] = getDayGroups()): GroupWindow[] {
  return groups.map((group, i) => {
    const anchor = parseTimeToMs(group.timeString);
    const next = groups[i + 1];
    const nextAnchor = next ? parseTimeToMs(next.timeString) : DAY_MS;
    const prev = groups[i - 1];

    // Ángelus then hour at the same mark (e.g. 06:00)
    if (group.kind === 'angelus' && next && nextAnchor === anchor) {
      return { group, startMs: anchor, endMs: anchor + ANGELUS_WINDOW_MS };
    }
    if (
      group.kind === 'hour' &&
      prev?.kind === 'angelus' &&
      parseTimeToMs(prev.timeString) === anchor
    ) {
      const hourEnd = next ? nextAnchor : DAY_MS;
      return {
        group,
        startMs: anchor + ANGELUS_WINDOW_MS,
        endMs: hourEnd,
      };
    }

    return { group, startMs: anchor, endMs: next ? nextAnchor : DAY_MS };
  });
}

interface SlotRange {
  slotIndex: number;
  startMs: number;
  endMs: number;
}

function buildSlotRanges(slots: PrayerSlot[], groups: PrayerGroup[]): SlotRange[] {
  const windows = buildGroupWindows(groups);
  const ranges: SlotRange[] = [];

  for (const win of windows) {
    const groupSlots = slotsForGroup(win.group);
    if (groupSlots.length === 0) continue;
    const weights = groupSlots.map(prayerWeight);
    const totalW = weights.reduce((a, b) => a + b, 0) || 1;
    const duration = Math.max(1, win.endMs - win.startMs);
    let t = win.startMs;

    for (let i = 0; i < groupSlots.length; i++) {
      const slotIndex = slots.findIndex(s => s.id === groupSlots[i].id);
      if (slotIndex < 0) continue;
      const slice = (weights[i] / totalW) * duration;
      const startMs = t;
      const endMs = i === groupSlots.length - 1 ? win.endMs : t + slice;
      ranges.push({ slotIndex, startMs, endMs });
      t = endMs;
    }
  }

  return ranges;
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

function findGroupIndex(slot: PrayerSlot, groups: PrayerGroup[]): number {
  if (slot.groupKind === 'angelus') {
    return groups.findIndex(g => g.kind === 'angelus' && g.timeString === slot.anchorTime);
  }
  return groups.findIndex(g => g.kind === 'hour' && g.hour === slot.hour);
}

export function getDayPosition(now: Date = new Date()): DayPosition {
  const progress = getDayProgress(now);
  const nowMs = progress * DAY_MS;
  const slots = getDaySlots();
  const groups = getDayGroups();
  const n = slots.length;
  const ranges = buildSlotRanges(slots, groups);

  let range = ranges[0];
  for (const r of ranges) {
    if (nowMs >= r.startMs && nowMs < r.endMs) {
      range = r;
      break;
    }
    if (nowMs >= r.startMs) range = r;
  }
  // Midnight edge: last Completas slice includes end of day
  if (ranges.length && nowMs >= ranges[ranges.length - 1].startMs) {
    range = ranges[ranges.length - 1];
  }

  const slotIndex = range?.slotIndex ?? 0;
  const span = Math.max(1, (range?.endMs ?? DAY_MS) - (range?.startMs ?? 0));
  const slotProgress = range
    ? Math.min(1, Math.max(0, (nowMs - range.startMs) / span))
    : 0;
  const slot = slots[slotIndex] ?? slots[0];
  const nextSlot = slots[(slotIndex + 1) % n] ?? null;
  const msUntilNext = Math.max(0, Math.round((1 - slotProgress) * span));
  const groupIndex = findGroupIndex(slot, groups);

  return {
    progress,
    slotIndex,
    slot,
    slotProgress,
    msUntilNext,
    minutesUntilNext: Math.ceil(msUntilNext / 60_000),
    nextSlot,
    groupIndex,
    group: groups[groupIndex] ?? groups[0],
  };
}

function slotsForGroup(group: PrayerGroup): PrayerSlot[] {
  const slots = getDaySlots();
  if (group.kind === 'angelus') {
    return slots.filter(s => s.groupKind === 'angelus' && s.anchorTime === group.timeString);
  }
  return slots.filter(s => s.groupKind === 'hour' && s.hour === group.hour);
}

function prayerWeight(slot: PrayerSlot): number {
  return Math.max(40, slot.fragment.text.replace(/\s+/g, ' ').trim().length);
}

/** Slots and progress within the current liturgical group (for dotted progress bar). */
export function getGroupProgress(
  now: Date = new Date(),
  slotIndexOverride?: number | null,
) {
  const pos = getDayPosition(now);
  const daySlots = getDaySlots();
  const n = daySlots.length;
  const groups = getDayGroups();

  const usingOverride =
    typeof slotIndexOverride === 'number' &&
    slotIndexOverride >= 0 &&
    slotIndexOverride < n &&
    slotIndexOverride !== pos.slotIndex;

  const slotIndex = usingOverride ? slotIndexOverride : pos.slotIndex;
  const slot = daySlots[slotIndex] ?? pos.slot;
  const groupIndex = findGroupIndex(slot, groups);
  const group = groups[groupIndex] ?? pos.group;
  const slots = slotsForGroup(group);
  const indexInGroup = Math.max(0, slots.findIndex(s => s.id === slot.id));
  const weights = slots.map(prayerWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  // Siguiente always follows the displayed slot's day-neighbor (not live clock when browsing).
  const nextSlot = daySlots[(slotIndex + 1) % n] ?? null;
  const slotProgress = usingOverride ? 0.5 : pos.slotProgress;
  const msUntilNext = usingOverride ? null : pos.msUntilNext;

  return {
    group,
    slots,
    indexInGroup,
    slotProgress,
    weights,
    totalWeight,
    msUntilNext,
    nextSlot,
    browsing: usingOverride,
  };
}

/** Titles for current + next liturgical group (fits one sidebar screen). */
export function getSidebarWheel(now: Date = new Date()) {
  const pos = getDayPosition(now);
  const groups = getDayGroups();
  const currentGroup = groups[pos.groupIndex];
  const nextGroup = groups[(pos.groupIndex + 1) % groups.length];
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
  const slots = getDaySlots();
  const n = slots.length;
  const result: PrayerSlot[] = [];
  for (let i = -before; i <= after; i++) {
    const idx = (slotIndex + i + n) % n;
    result.push(slots[idx]);
  }
  return result;
}

export function getUpcomingGroups(now: Date = new Date(), count = 4): PrayerGroup[] {
  const { groupIndex } = getDayPosition(now);
  const groups = getDayGroups();
  const result: PrayerGroup[] = [];
  for (let i = 0; i < count && i < groups.length; i++) {
    result.push(groups[(groupIndex + i) % groups.length]);
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

/** Coverage summary for docs / UI. */
export function getCoverageSummary(now: Date = new Date()) {
  const slots = getDaySlots();
  const groups = getDayGroups();
  const hourSlots = slots.filter(s => s.groupKind === 'hour').length;
  const angelus = slots.filter(s => s.groupKind === 'angelus').length;
  const windows = buildGroupWindows(groups);
  const pos = getDayPosition(now);
  const currentWin = windows[pos.groupIndex];
  const groupMins = currentWin
    ? Math.round((currentWin.endMs - currentWin.startMs) / 60_000)
    : 0;
  return {
    groups: groups.length,
    liturgicalHours: 7,
    angelusPerDay: angelus,
    prayerSnippets: slots.length,
    hourSnippets: hourSlots,
    /** Approx minutes for current group's window (not day-average). */
    currentGroupMinutes: groupMins,
    currentGroup: pos.group.label,
    source: officeSource,
    label: officeLabel,
  };
}
