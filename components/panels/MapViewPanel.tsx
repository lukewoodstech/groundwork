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
          {ACTIVITY.map((a) => {
            const on = filters.activity[a.value];
            return (
              <label
                key={a.value}
                className="flex h-9 cursor-pointer select-none items-center gap-3"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() =>
                    onChange({
                      ...filters,
                      activity: { ...filters.activity, [a.value]: !on },
                    })
                  }
                />
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
                <Glyph type={a.value} />
                <span className={`flex-1 text-[13px] ${on ? "text-ink" : "text-ink-3"}`}>
                  {a.label}
                </span>
                <span className="font-mono text-[11px] text-ink-3">{counts[a.value]}</span>
              </label>
            );
          })}
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
      </section>
    </aside>
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
