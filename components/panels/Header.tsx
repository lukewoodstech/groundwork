import { TODAY } from "@/lib/data/area";
import { Lockup } from "@/components/brand/Logo";

const today = TODAY.toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "America/Denver",
});

export default function Header() {
  return (
    <header className="pointer-events-auto flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel px-5">
      <Lockup />

      <div className="flex h-9 items-center gap-3 border border-line px-4">
        <span className="text-body font-medium text-ink">Edgemont Area</span>
        <span className="label text-ink-3">Provo, UT</span>
      </div>

      <time dateTime={TODAY.toISOString().slice(0, 10)} className="label text-ink-3">
        <span className="text-ink-2">Today</span> · {today}
      </time>
    </header>
  );
}
