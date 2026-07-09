import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HourName } from '../lib/hours';
import { LiturgicalFragment } from '../lib/liturgicalFragments';
import type { OfficeByHour } from '../lib/liturgicalDay';

/** Spanish LoH day texts — simpler than ingesting the 4-volume PDFs. */
export const LITURGY_BASE = 'https://liturgiadelashoras.github.io';

const LS_KEY = 'cathedral-office-v1';
const CACHE_DAYS = 3;

/** Prefer feria (generic) over regional memorials when several options exist. */
const PREFERRED_VARIANT = 3;

const HOUR_FILES: Record<HourName, string> = {
  Maitines: 'oficio.htm',
  Laudes: 'laudes.htm',
  Tercia: 'tercia.htm',
  Sexta: 'sexta.htm',
  Nona: 'nona.htm',
  Vísperas: 'visperas.htm',
  Completas: 'completas.htm',
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  uuml: 'ü',
  Uuml: 'Ü',
  laquo: '«',
  raquo: '»',
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  dagger: '†',
  Dagger: '‡',
  iexcl: '¡',
  iquest: '¿',
  ordm: 'º',
  ordf: 'ª',
  middot: '·',
  mdash: '—',
  ndash: '–',
  hellip: '…',
};

export interface OfficeDay {
  dateKey: string;
  label: string;
  sourceUrl: string;
  byHour: OfficeByHour;
  fragmentCount: number;
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCharCode(n) : _;
    }
    return ENTITIES[e] ?? _;
  });
}

function dayPath(date: Date): string {
  const y = date.getFullYear();
  const m = MONTHS[date.getMonth()];
  const d = String(date.getDate()).padStart(2, '0');
  return `${LITURGY_BASE}/sync/${y}/${m}/${d}`;
}

export function dateKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Liturgia ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('iso-8859-1').decode(buf);
}

function htmlToText(html: string): string {
  const cuerpo = html.match(/id=["']cuerpo["'][\s\S]*?<\/(?:DIV|div)>/i)?.[0] ?? html;
  return decodeEntities(
    cuerpo
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|tr|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const HOUR_HEADER =
  /^(LAUDES|OFICIO(?:\s+DE\s+LECTURA)?|TERCIA|SEXTA|NONA|V[IÍ]SPERAS|COMPLETAS)\b/i;

const SECTION_START =
  /^(INVITATORIO|SALMODIA|Himno:[^\n]{0,90}|Salmo\s+\d+[^\n]{0,90}|C[aá]ntico:[^\n]{0,90}|C[AÁ]NTICO EVANG[EÉ]LICO[^\n]{0,40}|LECTURA BREVE[^\n]{0,40}|RESPONSORIO BREVE|RESPONSORIO\b[^\n]{0,60}|LECTURA\b[^\n]{0,60}|PRECES|ORACI[OÓ]N\.?[^\n]{0,40}|CONCLUSI[OÓ]N|TE DEUM[^\n]{0,40})$/i;

function niceTitle(raw: string): string {
  return raw
    .replace(/^Ant\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

function toMarkdown(lines: string[]): string {
  return lines
    .map(line => {
      if (/^V\.\s/i.test(line)) return `**V.** ${line.slice(2).trim()}`;
      if (/^R\.\s/i.test(line)) return `**R.** ${line.slice(2).trim()}`;
      if (/^Ant\.?\s/i.test(line)) return `*${line}*`;
      return line;
    })
    .join('\n\n');
}

export function parseHourHtml(html: string, hour: HourName): LiturgicalFragment[] {
  const text = htmlToText(html);
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const start = lines.findIndex(l => HOUR_HEADER.test(l));
  const body = start >= 0 ? lines.slice(start + 1) : lines;

  const chunks: { title: string; lines: string[] }[] = [];
  let cur: { title: string; lines: string[] } | null = null;

  for (const line of body) {
    if (line.length < 120 && SECTION_START.test(line)) {
      if (cur && cur.lines.length > 0) chunks.push(cur);
      cur = { title: niceTitle(line), lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur && cur.lines.length > 0) chunks.push(cur);

  // Drop empty SALMODIA headers that only introduce the next psalm
  const filtered = chunks.filter(c => {
    if (/^SALMODIA$/i.test(c.title) && c.lines.length <= 2) return false;
    return c.lines.join(' ').length > 40;
  });

  if (filtered.length === 0) {
    return [{ title: hour, subtitle: 'Oficio del día', text: toMarkdown(body.slice(0, 40)) }];
  }

  return filtered.map(c => ({
    title: c.title,
    subtitle: hour,
    text: toMarkdown(c.lines),
  }));
}

async function resolveVariantBase(date: Date): Promise<{ base: string; label: string }> {
  const root = dayPath(date);
  const indexHtml = await fetchHtml(`${root}/`);
  const variants = [...indexHtml.matchAll(/HREF=["'](\d+)\/index\.htm["']/gi)].map(m => Number(m[1]));
  const unique = [...new Set(variants)].sort((a, b) => a - b);

  let chosen = unique.includes(PREFERRED_VARIANT)
    ? PREFERRED_VARIANT
    : unique[unique.length - 1] ?? PREFERRED_VARIANT;

  // If no regional menu, hours may sit directly under the day folder
  if (unique.length === 0) {
    const probe = await fetch(`${root}/laudes.htm`);
    if (probe.ok) {
      const label = format(date, "EEEE d 'de' MMMM", { locale: es });
      return { base: root, label };
    }
  }

  const variantIndex = await fetchHtml(`${root}/${chosen}/index.htm`);
  const strongs = [...variantIndex.matchAll(/<STRONG>([\s\S]*?)<\/STRONG>/gi)].map(m =>
    decodeEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
  ).filter(Boolean);
  const label =
    strongs.length > 0
      ? strongs.join(' · ')
      : format(date, "EEEE d 'de' MMMM", { locale: es });

  return { base: `${root}/${chosen}`, label };
}

function readCache(key: string): OfficeDay | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, OfficeDay>;
    return all[key] ?? null;
  } catch {
    return null;
  }
}

function writeCache(day: OfficeDay): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const all: Record<string, OfficeDay> = raw ? JSON.parse(raw) : {};
    all[day.dateKey] = day;
    const keys = Object.keys(all).sort();
    while (keys.length > CACHE_DAYS) {
      delete all[keys.shift()!];
    }
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

export async function fetchOfficeDay(date: Date = new Date()): Promise<OfficeDay> {
  const key = dateKey(date);
  const cached = readCache(key);
  if (cached?.byHour?.Laudes?.length) return cached;

  const { base, label } = await resolveVariantBase(date);
  const byHour = {} as OfficeByHour;
  let fragmentCount = 0;

  await Promise.all(
    (Object.keys(HOUR_FILES) as HourName[]).map(async hour => {
      const html = await fetchHtml(`${base}/${HOUR_FILES[hour]}`);
      const frags = parseHourHtml(html, hour);
      byHour[hour] = frags;
      fragmentCount += frags.length;
    }),
  );

  const day: OfficeDay = {
    dateKey: key,
    label,
    sourceUrl: base,
    byHour,
    fragmentCount,
  };
  writeCache(day);
  return day;
}
