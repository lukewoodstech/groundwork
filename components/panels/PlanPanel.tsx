"use client";

import type { Suggestion } from "@/lib/scoring";

export type PlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; source: "claude" | "fallback"; note?: string; suggestions: Suggestion[] }
  | { status: "error"; message: string };

type Props = {
  plan: PlanState;
  zoneNames: Map<string, string>;
  selectedId: string | null;
  routeNote: string | null;
  onPlan: () => void;
  onSelect: (s: Suggestion) => void;
};

const LABEL = {
  NEARBY: "Nearby",
  REPEAT_WHAT_WORKED: "Repeat what worked",
  NEGLECTED: "Neglected",
};

export default function PlanPanel({ plan, zoneNames, selectedId, routeNote, onPlan, onSelect }: Props) {
  const busy = plan.status === "loading";
  const count = plan.status === "done" ? plan.suggestions.length : 0;

  return (
    <aside className="pointer-events-auto absolute right-4 top-4 flex w-[320px] flex-col gap-3">
      <button
        type="button"
        onClick={onPlan}
        disabled={busy}
        className="flex h-12 w-full items-center justify-between bg-ink px-4 text-bg disabled:opacity-80"
      >
        <span className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" />
            <path d="M13 11l.6 1.4 1.4.6-1.4.6L13 15l-.6-1.4-1.4-.6 1.4-.6z" />
          </svg>
          <span className="text-[15px] font-medium">{busy ? "Planning…" : plan.status === "done" ? "Plan again" : "Plan my day"}</span>
        </span>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden>
          <path d="M1 6h15M11 1l5 5-5 5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>

      <div className="flex items-baseline justify-between px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        <span className="text-ink-2">Suggested for today</span>
        <span>{String(count).padStart(2, "0")} places</span>
      </div>

      {plan.status === "idle" && (
        <div className="border border-line bg-panel p-4">
          <p className="text-sm text-ink-2">No plan yet.</p>
          <p className="mt-1.5 text-[13px] leading-5 text-ink-3">
            Plan my day ranks this area by what has been neglected, what worked recently, and what
            is close to today&rsquo;s appointments, then asks Claude to pick three places.
          </p>
        </div>
      )}

      {plan.status === "loading" && (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse border border-line bg-panel p-4" aria-hidden>
              <div className="h-2 w-16 bg-raised" />
              <div className="mt-3 h-3.5 w-32 bg-raised" />
              <div className="mt-3 h-2.5 w-full bg-raised" />
              <div className="mt-1.5 h-2.5 w-3/4 bg-raised" />
            </div>
          ))}
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3" role="status">
            Ranking zones, asking Claude
          </p>
        </>
      )}

      {plan.status === "error" && (
        <div className="border border-line bg-panel p-4">
          <p className="text-sm text-ink">Couldn&rsquo;t make a plan.</p>
          <p className="mt-1.5 text-[13px] leading-5 text-ink-3">{plan.message}</p>
          <button type="button" onClick={onPlan} className="mt-3 border border-line-strong px-3 py-1.5 text-[12px] text-ink hover:bg-raised">
            Try again
          </button>
        </div>
      )}

      {plan.status === "done" &&
        plan.suggestions.map((s, i) => {
          const selected = s.zoneId === selectedId;
          return (
            <button
              key={s.zoneId}
              type="button"
              onClick={() => onSelect(s)}
              aria-pressed={selected}
              className={`border bg-panel p-4 text-left ${selected ? "border-ink" : "border-line hover:border-line-strong"}`}
            >
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                <span className="text-ink-2">{LABEL[s.type]}</span>
                <span className="text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="mt-2 text-[15px] font-medium text-ink">{zoneNames.get(s.zoneId) ?? s.zoneId}</div>
              <p className="mt-1 text-[13px] leading-5 text-ink-2">{s.reason}</p>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <span className={selected ? "text-ink" : ""}>{selected ? "On map" : "View on map"}</span>
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
                  <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              {selected && routeNote && (
                <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-ink-3">{routeNote}</p>
              )}
            </button>
          );
        })}

      {plan.status === "done" && plan.source === "fallback" && (
        <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
          Ranked by score · {plan.note ?? "AI unavailable"}
        </p>
      )}
    </aside>
  );
}
