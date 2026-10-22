import Link from "next/link";
import { Mark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="grid h-dvh w-full place-items-center bg-bg px-4">
      <div className="panel-in w-full max-w-[360px] border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="flex items-center gap-3 text-ink">
            <Mark size={16} />
            <span className="text-body font-medium">Groundwork</span>
          </span>
          <span className="label text-ink-3">404</span>
        </div>
        <div className="px-4 pb-4 pt-4">
          <p className="text-title font-medium text-ink">This page isn&rsquo;t on the map.</p>
          <p className="mt-1.5 text-body text-ink-3">
            The address may have changed, or it never existed.
          </p>
          <Link
            href="/"
            className="ctl ctl-primary mt-4 inline-flex h-9 items-center gap-3 px-4 text-ctl font-medium"
          >
            Back to the map
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
              <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
