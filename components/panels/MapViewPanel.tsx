import { PREV, US, FADED, type RGB } from "@/lib/colors";
import type { ActionType, Filters, Who } from "@/lib/data/types";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  counts: Record<ActionType, number>;
  total: number;
};

const WHO: { value: Who; label: string }[] = [
  { value: "us", label: "Us" },
  { value: "prev", label: "Previous elders" },
  { value: "all", label: "Everyone" },
];

const ACTIVITY: { value: ActionType; label: string }[] = [
  { value: "knock", label: "Door knocks" },
  { value: "contact", label: "Street contacts" },
  { value: "lesson", label: "Lessons" },
];

const rgb = (c: RGB) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

export default function MapViewPanel({ filters, onChange, counts, total }: Props) {
  return (
    <aside className="pointer-events-auto absolute left-4 top-4 w-[336px] border border-line bg-panel">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <Label>Map view</Label>
        <span className="font-mono text-[10px] tracking-[0.1em] text-ink-3">
          {total} ACTIONS
        </span>
      </div>

      <section className="px-4 pb-4 pt-3">
        <Label>Missionaries</Label>
        <div role="radiogroup" className="mt-2 grid grid-cols-3 border border-line">
          {WHO.map((w) => {
            const active = filters.who === w.value;
            return (
              <button
                key={w.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...filters, who: w.value })}
                className={`h-9 whitespace-nowrap border-r border-line text-[12px] leading-none last:border-r-0 ${
                  active ? "bg-ink font-medium text-bg" : "text-ink-2 hover:bg-raised"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-t border-line px-4 pb-3 pt-3">
        <Label>Activity</Label>
        <div className="mt-1">
          {ACTIVITY.map((a) => (
            <Check
              key={a.value}
              on={filters.activity[a.value]}
              onToggle={() =>
                onChange({
                  ...filters,
                  activity: { ...filters.activity, [a.value]: !filters.activity[a.value] },
                })
              }
              label={a.label}
              glyph={<Glyph type={a.value} />}
              trail={counts[a.value]}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-line px-4 pb-3 pt-3">
        <Label>Layers</Label>
        <div className="mt-1">
          <Check
            on={filters.columns}
            onToggle={() => onChange({ ...filters, columns: !filters.columns })}
            label="Effort columns"
            glyph={<ColumnGlyph />}
            trail="H3"
          />
        </div>
      </section>

      <section className="border-t border-line px-4 pb-4 pt-3">
        <Label>Key</Label>
        <KeyRow label="Us" color={US} />
        <KeyRow label="Previous elders" color={PREV} />
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
          <span>Recent</span>
          <span>Older</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3">
          <Travel label="Not walked" level={0} />
          <Travel label="Once" level={1} />
          <Travel label="A few times" level={2} />
          <Travel label="Often" level={3} />
        </div>
      </section>
    </aside>
  );
}

function Check({
  on,
  onToggle,
  label,
  glyph,
  trail,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  glyph: React.ReactNode;
  trail: React.ReactNode;
}) {
  return (
    <label className="flex h-9 cursor-pointer select-none items-center gap-3">
      <input type="checkbox" className="sr-only" checked={on} onChange={onToggle} />
      <span
        aria-hidden
        className={`grid h-[14px] w-[14px] place-items-center border ${
          on ? "border-ink bg-ink" : "border-line-strong"
        }`}
      >
        {on && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5l2.5 2.5L8 1" stroke="#09090a" strokeWidth="1.4" />
          </svg>
        )}
      </span>
      {glyph}
      <span className={`flex-1 text-[13px] ${on ? "text-ink" : "text-ink-3"}`}>{label}</span>
      <span className="font-mono text-[11px] text-ink-3">{trail}</span>
    </label>
  );
}

function ColumnGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-ink-2">
      <path d="M7 1.5l4.5 2.6v5.2L7 11.9 2.5 9.3V4.1z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 6.7l4.5-2.6M7 6.7L2.5 4.1M7 6.7v5.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
      {children}
    </span>
  );
}

function KeyRow({ label, color }: { label: string; color: RGB }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="w-[104px] text-[12px] text-ink-2">{label}</span>
      <span
        className="h-[6px] flex-1"
        style={{ background: `linear-gradient(90deg, ${rgb(color)}, ${rgb(FADED)})` }}
      />
    </div>
  );
}

// How often a street was walked, as drawn on the map, in grey.
function Travel({ label, level }: { label: string; level: 0 | 1 | 2 | 3 }) {
  const core = [1, 1.2, 2.2, 3.6][level];
  const alpha = [0.3, 0.5, 0.8, 1][level];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="48" height="14" viewBox="0 0 48 14" aria-hidden>
        {level >= 2 && (
          <line x1="4" y1="7" x2="44" y2="7" stroke="#a3a3a8" strokeWidth={level === 3 ? 11 : 7} strokeLinecap="round" opacity={level === 3 ? 0.28 : 0.16} />
        )}
        <line x1="4" y1="7" x2="44" y2="7" stroke="#d4d4d8" strokeWidth={core} strokeLinecap="round" opacity={alpha} />
      </svg>
      <span className="text-center text-[10px] leading-tight text-ink-3">{label}</span>
    </div>
  );
}

// Same symbols as the map markers, in grey.
function Glyph({ type }: { type: ActionType }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-ink-2">
      {type === "knock" && <circle cx="7" cy="7" r="2.4" fill="currentColor" />}
      {type === "contact" && (
        <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
      {type === "lesson" && (
        <>
          <circle cx="7" cy="7" r="4.2" fill="currentColor" />
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#f4f4f5" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
