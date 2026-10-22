"use client";

import { useEffect, useRef, useState } from "react";
import { DAY_MS, RANGE_DAYS, TODAY } from "@/lib/data/area";
import { companionships } from "@/lib/data";
import {
  clampRange,
  daysAgoOfDate,
  dayStartMs,
  localParts,
  maxEndDay,
  periodDays,
  PERIODS,
  rangeLabel,
  rangeMs,
  shortDate,
  type TimeRange,
} from "@/lib/data/time";

type Props = {
  time: TimeRange;
  onChange: (t: TimeRange) => void;
  /** Days before today that have any activity, for the calendar dots. */
  activeDays: Set<number>;
};

const start = dayStartMs(RANGE_DAYS);
const span = dayStartMs(0) + DAY_MS - start;
const pct = (ms: number) => ((ms - start) / span) * 100;
// The track spans the padded area of its container.
const at = (p: number) => `calc(1.75rem + ${p / 100} * (100% - 3.5rem))`;

const months: { label: string; left: number }[] = [];
for (
  let d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 6, 1));
  d.getTime() <= TODAY.getTime();
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
) {
  const left = pct(d.getTime());
  if (left >= 0)
    months.push({
      label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase(),
      left,
    });
}
const transfers = companionships.slice(1).map((c) => pct(new Date(c.start).getTime()));

export default function Timeline({ time, onChange, activeDays }: Props) {
  const [playing, setPlaying] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const [rangeStart, rangeEnd] = rangeMs(time);

  const set = (t: TimeRange) => onChange(clampRange(t));
  const step = (dir: 1 | -1) => set({ ...time, endDay: time.endDay - dir * periodDays(time.period) });
  const canBack = time.endDay < maxEndDay(time.period);
  const canForward = time.endDay > 0;

  // Replay: the window walks forward one day at a time until it reaches today.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (time.endDay <= 0) {
        setPlaying(false);
      } else {
        onChange({ ...time, endDay: time.endDay - 1 });
      }
    }, 90);
    return () => clearInterval(id);
  }, [playing, time, onChange]);

  const togglePlay = () => {
    if (!playing && time.endDay <= 0) onChange({ ...time, endDay: maxEndDay(time.period) });
    setPlaying((p) => !p);
  };

  const scrubTo = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inner = 28; // 1.75rem gutters
    const f = (clientX - rect.left - inner) / (rect.width - inner * 2);
    set({ ...time, endDay: Math.round(RANGE_DAYS * (1 - Math.min(Math.max(f, 0), 1))) });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setPlaying(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubTo(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons & 1) scrubTo(e.clientX);
  };

  return (
    <div className="panel-in pointer-events-auto mx-auto mb-5 flex w-[min(1040px,calc(100%-2rem))] shrink-0 flex-col items-center gap-3">
      <div className="relative flex items-stretch gap-3">
        <div role="radiogroup" aria-label="Window length" className="flex border border-line bg-panel">
          {PERIODS.map((p) => {
            const active = p.id === time.period;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ period: p.id, endDay: time.endDay })}
                className={`ctl h-9 border-r border-line px-4 text-ctl last:border-r-0 ${active ? "" : "text-ink-2"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex border border-line bg-panel">
          <Arrow dir={-1} disabled={!canBack} onClick={() => step(-1)} />
          <button
            type="button"
            onClick={() => setCalendarOpen((o) => !o)}
            aria-expanded={calendarOpen}
            aria-haspopup="dialog"
            title="Jump to a day"
            className="ctl h-9 min-w-[170px] px-3 text-ctl font-medium text-ink"
          >
            {rangeLabel(time)}
          </button>
          <Arrow dir={1} disabled={!canForward} onClick={() => step(1)} />
        </div>

        {calendarOpen && (
          <Calendar
            time={time}
            activeDays={activeDays}
            onPick={(endDay) => {
              setPlaying(false);
              set({ period: "day", endDay });
              setCalendarOpen(false);
            }}
            onClose={() => setCalendarOpen(false)}
          />
        )}
      </div>

      <div className="flex h-[76px] w-full items-stretch border border-line bg-panel">
        <button
          type="button"
          aria-label={playing ? "Pause replay" : "Replay the last six months"}
          title={playing ? "Pause" : "Replay"}
          onClick={togglePlay}
          className="ctl grid w-[60px] shrink-0 place-items-center border-r border-line text-ink"
        >
          {playing ? (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
              <rect x="1" y="1" width="3.5" height="12" />
              <rect x="7.5" y="1" width="3.5" height="12" />
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden>
              <path d="M1 1l10 6-10 6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div
          ref={track}
          className="relative flex-1 cursor-pointer touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          {months.map((m) => (
            <span
              key={m.label}
              className="absolute top-4 -translate-x-1/2 font-mono text-micro text-ink-3"
              style={{ left: at(m.left) }}
            >
              {m.label}
            </span>
          ))}
          <div className="absolute inset-x-7 top-[46px] h-px bg-line-strong" />
          <div
            className="absolute top-[40px] h-[13px] border-l border-ink bg-ink/10"
            style={{ left: at(pct(rangeStart)), width: `calc(${(rangeEnd - rangeStart) / span} * (100% - 3.5rem))` }}
          />
          <div
            className="absolute top-[46px] h-px bg-ink"
            style={{ left: at(pct(rangeStart)), width: `calc(${(rangeEnd - rangeStart) / span} * (100% - 3.5rem))` }}
          />
          {transfers.map((t) => (
            <span
              key={t}
              className="absolute top-[46px] -translate-x-1/2 -translate-y-1/2"
              style={{ left: at(t) }}
            >
              <span className="block h-[7px] w-[7px] rotate-45 border border-ink-2 bg-panel" />
              <span className="absolute left-1/2 top-[-18px] -translate-x-1/2 whitespace-nowrap font-mono text-micro text-ink-3">
                TRANSFER
              </span>
            </span>
          ))}
          <span
            className="absolute top-[46px] grid h-3 w-3 -translate-x-1/2 -translate-y-1/2 place-items-center border border-ink bg-panel"
            style={{ left: at(pct(rangeEnd)) }}
          >
            <span className="block h-1 w-1 bg-ink" />
          </span>
        </div>

        <div className="flex w-[150px] shrink-0 flex-col justify-center gap-1 border-l border-line px-5">
          <span className="label text-ink-3">Through</span>
          <span className="text-body font-medium text-ink">
            {shortDate(rangeEnd - 1)}, {localParts(rangeEnd - 1).year}
          </span>
        </div>
      </div>
    </div>
  );
}

function Arrow({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir > 0 ? "Later" : "Earlier"}
      title={dir > 0 ? "Later" : "Earlier"}
      disabled={disabled}
      onClick={onClick}
      className="ctl grid w-9 place-items-center text-ink-2"
    >
      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
        <path d={dir > 0 ? "M1 5h10M7 1l4 4-4 4" : "M11 5H1M5 1L1 5l4 4"} stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </button>
  );
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function Calendar({
  time,
  activeDays,
  onPick,
  onClose,
}: {
  time: TimeRange;
  activeDays: Set<number>;
  onPick: (endDay: number) => void;
  onClose: () => void;
}) {
  const [, endMs] = rangeMs(time);
  const shown = localParts(endMs - 1);
  const [view, setView] = useState({ year: shown.year, month: shown.month });

  const first = new Date(Date.UTC(view.year, view.month, 1));
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const title = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const selected = time.period === "day" ? time.endDay : -1;
  const move = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month + delta, 1));
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label="Jump to a day" className="panel-in absolute bottom-full left-1/2 z-20 mb-2 w-[272px] -translate-x-1/2 border border-line bg-panel p-3">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous month" onClick={() => move(-1)} className="ctl grid h-7 w-7 place-items-center text-ink-2">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
              <path d="M11 5H1M5 1L1 5l4 4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <span className="text-ctl font-medium text-ink">{title}</span>
          <button type="button" aria-label="Next month" onClick={() => move(1)} className="ctl grid h-7 w-7 place-items-center text-ink-2">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
              <path d="M1 5h10M7 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 font-mono text-micro text-ink-3">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="grid h-6 place-items-center">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: first.getUTCDay() }).map((_, i) => (
            <span key={`pad${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const endDay = daysAgoOfDate(view.year, view.month, day);
            const inData = endDay >= 0 && endDay <= RANGE_DAYS;
            const isSelected = endDay === selected;
            return (
              <button
                key={day}
                type="button"
                disabled={!inData}
                onClick={() => onPick(endDay)}
                aria-pressed={isSelected}
                className="ctl relative grid h-8 place-items-center text-ctl text-ink"
              >
                {day}
                {inData && activeDays.has(endDay) && (
                  <span className={`absolute bottom-1 h-[3px] w-[3px] ${isSelected ? "bg-bg" : "bg-ink-2"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
