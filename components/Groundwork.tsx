"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filterActions } from "@/lib/data/filter";
import { actions, appointments, companionships, streets, walks, zones } from "@/lib/data";
import { fetchWalkingRoute, zoneEntryPoint } from "@/lib/data/route";
import { fallbackPlan, scoreZones, validPlan, type Suggestion } from "@/lib/scoring";
import type { PlanResponse } from "@/app/api/plan/route";
import type { Focus } from "./map/layers";
import { daysAgoOf, rangeMs, type TimeRange } from "@/lib/data/time";
import type { ActionType, Filters } from "@/lib/data/types";
import LoadScreen from "./LoadScreen";
import Header from "./panels/Header";
import MapViewPanel from "./panels/MapViewPanel";
import PlanPanel, { type PlanState } from "./panels/PlanPanel";
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
    columns: false,
  });

  // Six months ending today. The missionary toggle and the time window are
  // independent: each narrows the same data.
  const [time, setTime] = useState<TimeRange>({ period: "6m", endDay: 0 });

  // The load screen lifts when the basemap draws, or after 8s if it never does.
  const [mapReady, setMapReady] = useState(!process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  useEffect(() => {
    const id = setTimeout(() => setMapReady(true), 8000);
    return () => clearTimeout(id);
  }, []);
  const [start, end] = rangeMs(time);

  // Everything by the chosen missionaries, all time. Feeds the calendar dots.
  const byWho = useMemo(
    () => filterActions(actions, companionships, { who: filters.who, activity: ALL_ACTIVITY, columns: false }),
    [filters.who],
  );
  const activeDays = useMemo(() => new Set(byWho.map((a) => daysAgoOf(a.time))), [byWho]);

  const inWindow = useMemo(() => byWho.filter((a) => a.time >= start && a.time < end), [byWho, start, end]);
  const visible = useMemo(() => inWindow.filter((a) => filters.activity[a.type]), [inWindow, filters.activity]);

  const visibleWalks = useMemo(() => {
    const current = new Set(companionships.filter((c) => c.isCurrent).map((c) => c.id));
    return walks.filter(
      (w) =>
        w.timestamps[0] >= start &&
        w.timestamps[0] < end &&
        (filters.who === "all" || current.has(w.companionshipId) === (filters.who === "us")),
    );
  }, [filters.who, start, end]);

  // Per-type counts in the window, independent of the toggles, so a row's
  // number does not vanish when it is switched off.
  const counts = useMemo(() => {
    const c: Record<ActionType, number> = { knock: 0, contact: 0, lesson: 0 };
    for (const a of inWindow) c[a.type] += 1;
    return c;
  }, [inWindow]);

  // Plan my day: deterministic ranking over the whole history, then Claude.
  const candidates = useMemo(() => scoreZones({ zones, actions, appointments, streets }), []);
  const zoneNames = useMemo(() => new Map(zones.map((z) => [z.id, z.name])), []);
  const [plan, setPlan] = useState<PlanState>({ status: "idle" });
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);

  const planDay = useCallback(async () => {
    setPlan({ status: "loading" });
    setSelected(null);
    setFocus(null);
    if (!candidates.length) {
      setPlan({ status: "error", message: "There are no zones to rank." });
      return;
    }
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidates, appointments }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PlanResponse;
      if (!validPlan(data.suggestions, candidates)) throw new Error("Bad plan");
      setPlan({ status: "done", source: data.source, note: data.note, suggestions: data.suggestions });
    } catch {
      // The planner itself is unreachable: rank locally so the day still gets planned.
      setPlan({ status: "done", source: "fallback", note: "Planner unreachable", suggestions: fallbackPlan(candidates) });
    }
  }, [candidates]);

  const selectSuggestion = useCallback(
    async (s: Suggestion) => {
      const zone = zones.find((z) => z.id === s.zoneId);
      const candidate = candidates.find((c) => c.zoneId === s.zoneId);
      const from = appointments.find((a) => a.id === candidate?.nearest.appointmentId) ?? appointments[0];
      if (!zone || !from) return;
      setSelected(s);
      setRouteNote(null);
      const to = zoneEntryPoint(zone, streets, from.lngLat);
      setFocus({ zone, from: from.lngLat, route: null });
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const route = token ? await fetchWalkingRoute(from.lngLat, to, token) : null;
      setFocus({ zone, from: from.lngLat, route });
      if (!route) setRouteNote("Walking route unavailable, showing a straight line");
    },
    [candidates],
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <MapView
        walks={visibleWalks}
        actions={visible}
        appointments={appointments}
        companionships={companionships}
        columns={filters.columns}
        focus={focus}
        onReady={() => setMapReady(true)}
      />
      <LoadScreen ready={mapReady} />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <Header />
        <div className="relative flex-1">
          <MapViewPanel
            filters={filters}
            onChange={setFilters}
            counts={counts}
            total={visible.length}
          />
          <PlanPanel
            plan={plan}
            zoneNames={zoneNames}
            selectedId={selected?.zoneId ?? null}
            routeNote={routeNote}
            onPlan={planDay}
            onSelect={selectSuggestion}
          />
        </div>
        <Timeline time={time} onChange={setTime} activeDays={activeDays} />
      </div>
    </main>
  );
}
