"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { PickingInfo } from "@deck.gl/core";
import "mapbox-gl/dist/mapbox-gl.css";
import { appointments as todaysAppointments, area, bbox, streets } from "@/lib/data";
import { walkedSegments } from "@/lib/data/segments";
import type { Action, Appointment, Companionship, Walk } from "@/lib/data/types";
import { buildLayers, type Focus } from "./layers";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Mapbox terrain throws deck.gl's camera sync off with mapbox-gl v3: columns
// land hundreds of metres from their streets (overlaid) or vanish behind the
// terrain depth buffer (interleaved). Off until that is resolved.
const TERRAIN = false;

const PITCH = 45;
const BEARING = -18;
// Room for the header, panels and timeline when framing the area.
const PADDING = { top: 70, bottom: 170, left: 372, right: 350 };

// Pull the dark style toward the panel colour and keep only major street
// names, so the data is the brightest thing on screen.
function quietBasemap(map: mapboxgl.Map) {
  map.setPaintProperty("land", "background-color", "#0e0e10");
  map.setPaintProperty("landuse", "fill-color", "#111113");
  map.setPaintProperty("national-park", "fill-color", "#111113");
  map.setPaintProperty("water", "fill-color", "#0a0a0b");
  map.setPaintProperty("building", "fill-color", "#131315");
  map.setPaintProperty("building", "fill-outline-color", "#0e0e10");
  for (const id of ["road-simple", "bridge-simple", "tunnel-simple"]) {
    map.setPaintProperty(id, "line-color", "#28282b");
  }
  for (const id of ["road-path", "road-path-trail", "road-pedestrian", "road-steps"]) {
    map.setPaintProperty(id, "line-color", "#1d1d20");
  }
  for (const id of ["poi-label", "natural-point-label", "natural-line-label"]) {
    map.setLayoutProperty(id, "visibility", "none");
  }
  // Major road classes only, and no numbered grid names like "3700 N".
  map.setFilter("road-label-simple", [
    "all",
    map.getFilter("road-label-simple") ?? true,
    ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary"], true, false],
    [">", ["slice", ["get", "name"], 0, 1], "9"],
  ]);
  map.setPaintProperty("road-label-simple", "text-color", "#8a8a90");
  map.setPaintProperty("road-label-simple", "text-opacity", 0.7);
  map.setPaintProperty("settlement-subdivision-label", "text-opacity", 0.7);
}

// Time labels beside today's appointments, drawn by Mapbox above everything.
function addAppointmentLabels(map: mapboxgl.Map) {
  map.addSource("appointment-labels", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: todaysAppointments.map((a) => ({
        type: "Feature",
        properties: { label: clock(a.time) },
        geometry: { type: "Point", coordinates: a.lngLat },
      })),
    },
  });
  map.addLayer({
    id: "appointment-labels",
    type: "symbol",
    source: "appointment-labels",
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
      "text-size": 11,
      "text-anchor": "left",
      "text-offset": [1.1, 0],
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#f4f4f5", "text-halo-color": "#0e0e10", "text-halo-width": 1.5 },
  });
}

// Thin white border, a faint fill, and a dimming mask over everything outside.
function addArea(map: mapboxgl.Map, beforeId?: string) {
  const ring = [...area.polygon, area.polygon[0]];
  const feature = (coordinates: number[][][]): GeoJSON.Feature => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates },
  });
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  map.addSource("area", { type: "geojson", data: feature([ring]) });
  map.addSource("area-mask", { type: "geojson", data: feature([world, ring]) });
  map.addLayer(
    { id: "area-mask", type: "fill", source: "area-mask", paint: { "fill-color": "#09090a", "fill-opacity": 0.5 } },
    beforeId,
  );
  map.addLayer(
    { id: "area-fill", type: "fill", source: "area", paint: { "fill-color": "#ffffff", "fill-opacity": 0.03 } },
    beforeId,
  );
  map.addLayer(
    {
      id: "area-line",
      type: "line",
      source: "area",
      paint: { "line-color": "#f4f4f5", "line-width": 1, "line-opacity": 0.85 },
    },
    beforeId,
  );
}

type Props = {
  walks: Walk[];
  actions: Action[];
  appointments: Appointment[];
  companionships: Companionship[];
  columns: boolean;
  focus: Focus | null;
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });

export default function MapView({ walks, actions, appointments, companionships, columns, focus }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [labelLayerId, setLabelLayerId] = useState<string>();
  const [ready, setReady] = useState(false);

  const current = useMemo(
    () => new Set(companionships.filter((c) => c.isCurrent).map((c) => c.id)),
    [companionships],
  );
  const names = useMemo(() => new Map(companionships.map((c) => [c.id, c.name])), [companionships]);
  const segments = useMemo(() => walkedSegments(walks), [walks]);

  useEffect(() => {
    if (!TOKEN || !container.current) return;
    mapboxgl.accessToken = TOKEN;

    const bounds = bbox(area.polygon);
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
      zoom: 14,
      pitch: PITCH,
      bearing: BEARING,
      minZoom: 12,
      maxPitch: 70,
      antialias: true,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;

    map.on("style.load", () => {
      if (TERRAIN) {
        map.addSource("dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "dem", exaggeration: 1 });
      }
      map.setFog({
        color: "#0b0b0c",
        "high-color": "#0b0b0c",
        "space-color": "#070708",
        "horizon-blend": 0.04,
        "star-intensity": 0,
      });
      quietBasemap(map);

      // First symbol layer: everything we add goes underneath the labels.
      const firstLabel = map.getStyle()?.layers.find((l) => l.type === "symbol")?.id;

      map.addLayer(
        {
          id: "buildings",
          type: "fill-extrusion",
          source: "composite",
          "source-layer": "building",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "#19191c",
            "fill-extrusion-height": 3.5,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.95,
            "fill-extrusion-vertical-gradient": false,
          },
        },
        firstLabel,
      );
      addArea(map, firstLabel);

      // Frame the whole area, leaving room for the panels.
      const camera = map.cameraForBounds(bounds, { padding: PADDING, bearing: BEARING, pitch: PITCH });
      // cameraForBounds is conservative under pitch; tighten a little.
      if (camera) map.jumpTo({ ...camera, zoom: (camera.zoom ?? 14) + 0.55, pitch: PITCH, bearing: BEARING });

      overlay.current = new MapboxOverlay({ interleaved: true, layers: [] });
      map.addControl(overlay.current);
      addAppointmentLabels(map);
      setLabelLayerId(firstLabel);
      setReady(true);
    });

    return () => {
      overlay.current = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, []);

  // Fly to a chosen suggestion: the zone, the appointment, and the walk between.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    const pts: [number, number][] = [...focus.zone.polygon, focus.from, ...(focus.route ?? [])];
    map.fitBounds(bbox(pts), { padding: { top: 90, bottom: 190, left: 390, right: 370 }, pitch: PITCH, bearing: BEARING, duration: 1400 });
  }, [ready, focus]);

  useEffect(() => {
    if (!ready || !overlay.current) return;
    overlay.current.setProps({
      layers: buildLayers({ streets, segments, actions, appointments, focus, current, columns, beforeId: labelLayerId }),
      getTooltip: ({ object, layer }: PickingInfo<Action | Appointment>) => {
        if (!object || !layer) return null;
        const style = { background: "#0e0e10", border: "1px solid #262629", padding: "8px 10px" };
        if (layer.id === "appointments") {
          const ap = object as Appointment;
          return {
            html: `<div style="font:500 12px var(--font-geist-sans),sans-serif;color:#f4f4f5">${ap.label}</div>
            <div style="font:11px var(--font-geist-mono),monospace;color:#a3a3a8;margin-top:3px">Today · ${clock(ap.time)}</div>`,
            style,
          };
        }
        if (!layer.id.startsWith("actions-")) return null;
        const a = object as Action;
        const when = new Date(a.time).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Denver",
        });
        const label = { knock: "Door knock", contact: "Street contact", lesson: "Lesson" }[a.type];
        const outcome = { none: "", interested: "Interested", lesson_set: "Lesson set" }[a.outcome];
        return {
          html: `<div style="font:500 12px var(--font-geist-sans),sans-serif;color:#f4f4f5">${label}</div>
            <div style="font:11px var(--font-geist-mono),monospace;color:#a3a3a8;margin-top:3px">${names.get(a.companionshipId) ?? ""} · ${when}${outcome ? ` · ${outcome}` : ""}</div>`,
          style,
        };
      },
    });
  }, [ready, segments, actions, appointments, focus, current, columns, labelLayerId, names]);

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg">
        <div className="border border-line bg-panel px-6 py-5 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">Map unavailable</p>
          <p className="mt-2 text-sm text-ink-2">
            Add <span className="font-mono text-ink">NEXT_PUBLIC_MAPBOX_TOKEN</span> to{" "}
            <span className="font-mono text-ink">.env.local</span> and restart.
          </p>
        </div>
      </div>
    );
  }

  // Mapbox's stylesheet sets `position: relative` on its container, so the
  // sizing lives on a wrapper and the map fills it.
  return (
    <div className="absolute inset-0 bg-bg">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
