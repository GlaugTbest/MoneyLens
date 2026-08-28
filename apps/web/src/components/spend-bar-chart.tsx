'use client';

import { useState } from 'react';
import { formatBRL, formatMonth } from '@/lib/format';

interface SpendPoint {
  period: string;
  totalSpent: number;
}

const BAR_AREA_HEIGHT = 140;
const LABEL_ROW_HEIGHT = 20;
const MAX_BAR_WIDTH = 24;

export function SpendBarChart({ data }: { data: SpendPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.totalSpent));
  const gridFractions = [1, 0.5, 0];

  return (
    <div>
      <div
        className="relative flex items-end gap-1"
        style={{ height: BAR_AREA_HEIGHT }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* grid: three recessive hairlines (100% / 50% / baseline) */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {gridFractions.map((f) => (
            <div key={f} className="border-t border-border" />
          ))}
        </div>

        {data.map((d, i) => {
          const pct = Math.max(2, (d.totalSpent / max) * 100);
          const isHovered = hovered === i;
          return (
            <div
              key={d.period}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              role="img"
              aria-label={`${formatMonth(d.period)}: ${formatBRL(d.totalSpent)}`}
            >
              {isHovered && (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium tabular-nums text-background shadow-md"
                  style={{ bottom: `calc(${pct}% + 8px)`, left: '50%' }}
                >
                  {formatBRL(d.totalSpent)}
                </div>
              )}
              <div
                className="rounded-t transition-colors duration-150"
                style={{
                  height: `${pct}%`,
                  width: MAX_BAR_WIDTH,
                  maxWidth: '70%',
                  background: isHovered ? 'var(--accent-hover)' : 'var(--accent)',
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1" style={{ height: LABEL_ROW_HEIGHT }}>
        {data.map((d) => (
          <span
            key={d.period}
            className="flex-1 text-center text-[11px] text-subtle-foreground"
          >
            {formatMonth(d.period)}
          </span>
        ))}
      </div>
    </div>
  );
}
