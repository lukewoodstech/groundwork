"use client";

import { useEffect, useState } from "react";
import { Mark } from "./brand/Logo";

/**
 * Covers the map while it initialises: the mark and a thin progress line.
 * When `ready` flips, the line completes, then the screen fades out and unmounts.
 */
export default function LoadScreen({ ready }: { ready: boolean }) {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const fade = setTimeout(() => setFading(true), 200);
    const unmount = setTimeout(() => setGone(true), 200 + 300);
    return () => {
      clearTimeout(fade);
      clearTimeout(unmount);
    };
  }, [ready]);

  if (gone) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ready ? "Map ready" : "Loading map"}
      className={`absolute inset-0 z-50 grid place-items-center bg-bg transition-opacity duration-300 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex w-[160px] flex-col items-center gap-6">
        <Mark size={32} className="text-ink" />
        <div className="h-px w-full bg-line">
          <div className={`h-px bg-ink ${ready ? "w-full transition-[width] duration-200" : "loader-bar"}`} />
        </div>
      </div>
    </div>
  );
}
