"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { INITIAL_VIEW } from "@/lib/data/area";
import type { Action, Companionship } from "@/lib/data/types";
import { buildLayers } from "./layers";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Mapbox terrain throws deck.gl's camera sync off with mapbox-gl v3: columns
// land hundreds of metres from their streets (overlaid) or vanish behind the
// terrain depth buffer (interleaved). Off until that is resolved.
const TERRAIN = false;

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

type Props = { actions: Action[]; companionships: Companionship[] };

export default function MapView({ actions, companionships }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const [labelLayerId, setLabelLayerId] = useState<string>();
  const [ready, setReady] = useState(false);

  const current = useMemo(
    () => new Set(companionships.filter((c) => c.isCurrent).map((c) => c.id)),
    [companionships],
  );

  useEffect(() => {
    if (!TOKEN || !container.current) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/dark-v11",
      ...INITIAL_VIEW,
      minZoom: 12,
      maxPitch: 70,
      antialias: true,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

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
      const firstLabel = map
        .getStyle()
        ?.layers.find((l) => l.type === "symbol")?.id;

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

      overlay.current = new MapboxOverlay({ interleaved: true, layers: [] });
      map.addControl(overlay.current);
      setLabelLayerId(firstLabel);
      setReady(true);
    });

    return () => {
      overlay.current = null;
      setReady(false);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !overlay.current) return;
    overlay.current.setProps({
      layers: buildLayers(actions, current, labelLayerId),
    });
  }, [ready, actions, current, labelLayerId]);

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg">
        <div className="border border-line bg-panel px-6 py-5 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            Map unavailable
          </p>
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
