import { useLayoutEffect, useRef, useState } from 'react';

export interface TickerLine {
  id: string;
  label: string;
  hint?: string;
}

interface VerticalTickerProps {
  lines: TickerLine[];
  /** Fractional index: whole part = row, decimal = progress into next row */
  position: number;
  className?: string;
  'aria-label'?: string;
}

const ROW_PX = 52;

/**
 * Split-flap / departure-board style vertical scroll (face-on, not a side wheel).
 */
export function VerticalTicker({ lines, position, className = '', 'aria-label': ariaLabel }: VerticalTickerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewH, setViewH] = useState(240);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  if (lines.length === 0) return null;

  const n = lines.length;
  const loop = [...lines, ...lines, ...lines];
  const centerOffset = n;
  const y = viewH / 2 - (position + centerOffset + 0.5) * ROW_PX;

  return (
    <div
      ref={viewportRef}
      className={`ticker-viewport ${className}`}
      aria-label={ariaLabel}
      role="marquee"
      aria-live="polite"
    >
      <div className="ticker-slot" aria-hidden />
      <div className="ticker-track" style={{ transform: `translate3d(0, ${y}px, 0)` }}>
        {loop.map((line, i) => {
          const logical = i % n;
          const activeLogical = ((Math.floor(position) % n) + n) % n;
          const inMiddleBand = i >= centerOffset && i < centerOffset + n;
          const isActive = inMiddleBand && logical === activeLogical;
          return (
            <div
              key={`${line.id}-${i}`}
              className={`ticker-row ${isActive ? 'is-active' : ''}`}
            >
              <span className="ticker-row-label">{line.label}</span>
              {line.hint && <span className="ticker-row-hint">{line.hint}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
