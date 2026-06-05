import {
  ANGELUS_TIMES,
  DAY_GROUPS,
  formatMinutesUntil,
  getDayPosition,
  getNearbySlots,
} from '../lib/liturgicalDay';
import { HOURS_SCHEDULE, LiturgicalHour } from '../lib/hours';

interface DayPlaylistSidebarProps {
  currentTime: Date;
  currentHour: LiturgicalHour | null;
}

/** Fixed day rhythm — readable from across the room. */
function DayRhythmStrip({ currentHour }: { currentHour: LiturgicalHour | null }) {
  return (
    <ul className="sidebar-rhythm-list space-y-2" aria-label="Horas del día">
      {HOURS_SCHEDULE.map(h => {
        const hasAngelus = ANGELUS_TIMES.includes(h.timeString as (typeof ANGELUS_TIMES)[number]);
        const isCurrent = currentHour?.name === h.name;
        return (
          <li
            key={h.name}
            className={`sidebar-rhythm-row ${isCurrent ? 'is-current' : ''}`}
          >
            <span className="sidebar-rhythm-time">{h.timeString}</span>
            <span className="sidebar-rhythm-name">
              {hasAngelus && <span className="sidebar-angelus-tag">Ángelus · </span>}
              {h.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function DayPlaylistSidebar({ currentTime, currentHour }: DayPlaylistSidebarProps) {
  const pos = getDayPosition(currentTime);
  const nearby = getNearbySlots(currentTime, 0, 2);
  const nextGroups = DAY_GROUPS.slice(pos.groupIndex, pos.groupIndex + 3);

  return (
    <div className="sidebar-simple flex flex-col flex-1 min-h-0 px-4 py-3 gap-4">
      {/* Now / Next — largest text on the bar */}
      <section className="sidebar-now-block shrink-0">
        <p className="sidebar-label">Ahora</p>
        <p className="sidebar-now-title">
          {pos.slot.groupKind === 'angelus' ? 'Ángelus' : pos.slot.title}
        </p>
        {pos.slot.subtitle && pos.slot.groupKind !== 'angelus' && (
          <p className="sidebar-now-sub">{pos.slot.subtitle}</p>
        )}
        {pos.nextSlot && (
          <p className="sidebar-next-line">
            Después: <strong>{pos.nextSlot.title}</strong>
            <span className="sidebar-next-when"> · {formatMinutesUntil(pos.msUntilNext)}</span>
          </p>
        )}
      </section>

      {/* Next 3 prayer titles only (not all 73) */}
      <section className="sidebar-nearby shrink-0" aria-label="Próximos rezos">
        <p className="sidebar-label">Siguientes rezos</p>
        <ol className="sidebar-nearby-list">
          {nearby.map((slot, i) => (
            <li key={slot.id} className={i === 0 ? 'is-now' : ''}>
              {i === 0 ? '▸ ' : ''}
              {slot.groupKind === 'angelus' ? 'Ángelus' : slot.title}
            </li>
          ))}
        </ol>
      </section>

      {/* Next liturgical groups — plain lines, no chips */}
      <section className="sidebar-groups shrink-0" aria-label="Grupos de oración">
        <p className="sidebar-label">Grupos que vienen</p>
        <ul className="sidebar-groups-list">
          {nextGroups.map((g, i) => (
            <li key={g.id} className={i === 0 ? 'is-now' : ''}>
              {g.kind === 'angelus' ? 'Ángelus' : g.label}
              <span className="opacity-60"> · {g.timeString}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Seven hours + Ángelus — scannable from TV */}
      <section className="sidebar-rhythm flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <p className="sidebar-label">Ritmo del día</p>
        <DayRhythmStrip currentHour={currentHour} />
      </section>
    </div>
  );
}
