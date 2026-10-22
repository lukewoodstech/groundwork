export default function PlanPanel() {
  return (
    <aside className="pointer-events-auto absolute right-4 top-4 flex w-[320px] flex-col gap-3">
      <button
        type="button"
        aria-disabled="true"
        title="Plan my day arrives in a later phase"
        className="flex h-12 w-full items-center justify-between bg-ink px-4 text-bg"
      >
        <span className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" />
            <path d="M13 11l.6 1.4 1.4.6-1.4.6L13 15l-.6-1.4-1.4-.6 1.4-.6z" />
          </svg>
          <span className="text-[15px] font-medium">Plan my day</span>
        </span>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden>
          <path d="M1 6h15M11 1l5 5-5 5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>

      <div className="flex items-baseline justify-between px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        <span className="text-ink-2">Suggested for today</span>
        <span>0 places</span>
      </div>

      <div className="border border-line bg-panel p-4">
        <p className="text-sm text-ink-2">No plan yet.</p>
        <p className="mt-1.5 text-[13px] leading-5 text-ink-3">
          Plan my day will rank this area by what has been neglected, what
          worked recently, and what is close to today&rsquo;s appointments.
        </p>
      </div>
    </aside>
  );
}
