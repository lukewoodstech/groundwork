import { TODAY } from "@/lib/data/area";

const today = TODAY.toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "America/Denver",
});

export default function Header() {
  return (
    <header className="pointer-events-auto flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel px-5">
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center border border-line-strong text-ink">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M3.5 14L7 7.5l4 2.5 3.5-6.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="3.5" cy="14" r="1.6" fill="currentColor" />
            <rect x="13" y="2" width="3" height="3" fill="currentColor" />
          </svg>
        </span>
        <span className="text-[15px] font-medium tracking-[-0.01em]">Groundwork</span>
      </div>

      <div className="flex h-9 items-center gap-6 border border-line px-4 text-sm">
        <span>Edgemont Area</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>

      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        <span className="text-ink-2">Today</span> · {today}
      </div>
    </header>
  );
}
