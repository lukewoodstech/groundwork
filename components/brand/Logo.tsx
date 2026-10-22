/**
 * The Groundwork mark: a block of ground with one path cut through it.
 * One place to change it: the header, load screen and 404 page all draw this
 * component. Inherits `currentColor`. Source of truth: brand/mark.svg.
 */
export const MARK_PATH = "M2 2H30V8H10V18H2ZM14 12H30V30H2V22H14Z";

export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** Mark plus name, as used in the header. */
export function Lockup() {
  return (
    <span className="flex items-center gap-3 text-ink">
      <Mark size={20} />
      <span className="text-title font-medium">Groundwork</span>
    </span>
  );
}
