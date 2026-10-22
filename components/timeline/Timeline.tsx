import { DAY_MS, RANGE_DAYS, TODAY } from "@/lib/data/area";
import { companionships } from "@/lib/data/mock";

// Placeholder. Scrubbing, play, and the chips go live in Phase 3.

const CHIPS = ["Last 7 days", "Last 30 days", "Since we arrived", "All time"];
const ACTIVE_CHIP = "Since we arrived";

const start = TODAY.getTime() - RANGE_DAYS * DAY_MS;
const pct = (t: number) => ((t - start) / (RANGE_DAYS * DAY_MS)) * 100;
// Track spans the padded area of its container.
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
const usStart = transfers[transfers.length - 1];

const viewingThrough = TODAY.toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Denver",
});

export default function Timeline() {
  return (
    <div className="pointer-events-auto mx-auto mb-5 flex w-[min(1040px,calc(100%-2rem))] shrink-0 flex-col items-center gap-3">
      <div className="flex border border-line bg-panel">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === ACTIVE_CHIP}
            className={`h-9 border-r border-line px-4 text-[12px] last:border-r-0 ${
              c === ACTIVE_CHIP ? "bg-ink font-medium text-bg" : "text-ink-2 hover:bg-raised"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex h-[76px] w-full items-stretch border border-line bg-panel">
        <button
          type="button"
          aria-label="Play"
          className="grid w-[60px] shrink-0 place-items-center border-r border-line text-ink hover:bg-raised"
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden>
            <path d="M1 1l10 6-10 6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="relative flex-1">
          {months.map((m) => (
            <span
              key={m.label}
              className="absolute top-4 -translate-x-1/2 font-mono text-[9px] tracking-[0.14em] text-ink-3"
              style={{ left: at(m.left) }}
            >
              {m.label}
            </span>
          ))}
          <div className="absolute inset-x-7 top-[46px] h-px bg-line-strong" />
          <div
            className="absolute top-[40px] h-[13px] border-l border-ink bg-ink/10"
            style={{ left: at(usStart), right: "1.75rem" }}
          />
          <div
            className="absolute top-[46px] h-px bg-ink"
            style={{ left: at(usStart), right: "1.75rem" }}
          />
          {transfers.map((t) => (
            <span
              key={t}
              className="absolute top-[46px] -translate-x-1/2 -translate-y-1/2"
              style={{ left: at(t) }}
            >
              <span className="block h-[7px] w-[7px] rotate-45 border border-ink-2 bg-panel" />
              <span className="absolute left-1/2 top-[-18px] -translate-x-1/2 whitespace-nowrap font-mono text-[8px] tracking-[0.14em] text-ink-3">
                TRANSFER
              </span>
            </span>
          ))}
          <span className="absolute right-7 top-[46px] grid h-3 w-3 -translate-y-1/2 translate-x-1/2 place-items-center border border-ink bg-panel">
            <span className="block h-1 w-1 bg-ink" />
          </span>
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-1 border-l border-line px-5">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
            Viewing through
          </span>
          <span className="text-[13px] font-medium text-ink">{viewingThrough}</span>
        </div>
      </div>
    </div>
  );
}
