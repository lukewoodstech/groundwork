"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { filterActions } from "@/lib/data/filter";
import { actions, companionships } from "@/lib/data/mock";
import type { ActionType, Filters } from "@/lib/data/types";
import Header from "./panels/Header";
import MapViewPanel from "./panels/MapViewPanel";
import PlanPanel from "./panels/PlanPanel";
import Timeline from "./timeline/Timeline";

const MapView = dynamic(() => import("./map/MapView"), { ssr: false });

const ALL_ACTIVITY: Record<ActionType, boolean> = {
  knock: true,
  contact: true,
  lesson: true,
};

export default function Groundwork() {
  const [filters, setFilters] = useState<Filters>({
    who: "all",
    activity: ALL_ACTIVITY,
  });

  const visible = useMemo(
    () => filterActions(actions, companionships, filters),
    [filters],
  );

  // Per-type counts for the chosen missionaries, independent of the toggles,
  // so a row's number does not vanish when it is switched off.
  const counts = useMemo(() => {
    const pool = filterActions(actions, companionships, {
      who: filters.who,
      activity: ALL_ACTIVITY,
    });
    const c: Record<ActionType, number> = { knock: 0, contact: 0, lesson: 0 };
    for (const a of pool) c[a.type] += 1;
    return c;
  }, [filters.who]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <MapView actions={visible} companionships={companionships} />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <Header />
        <div className="relative flex-1">
          <MapViewPanel
            filters={filters}
            onChange={setFilters}
            counts={counts}
            total={visible.length}
          />
          <PlanPanel />
        </div>
        <Timeline />
      </div>
    </main>
  );
}
