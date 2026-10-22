/**
 * The Groundwork mark. One place to change it: the header, load screen and
 * 404 page all draw this component. Inherits `currentColor`.
 */
export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path d="M11 2v28M21 2v28M2 11h28M2 21h28" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
      <path d="M2 21h9V11h10V2" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

/** Mark plus name, as used in the header. */
export function Lockup() {
  return (
    <span className="flex items-center gap-3 text-ink">
      <span className="grid h-7 w-7 place-items-center border border-line-strong">
        <Mark size={18} />
      </span>
      <span className="text-title font-medium">Groundwork</span>
    </span>
  );
}
