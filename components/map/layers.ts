import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { latLngToCell } from "h3-js";
import { ageColor, PREV, US, type RGB } from "@/lib/colors";
import { DAY_MS, TODAY } from "@/lib/data/area";
import type { Segment } from "@/lib/data/segments";
import type { Action, ActionType } from "@/lib/data/types";

export const HEX_RESOLUTION = 10;

type Hex = { hex: string; count: number; daysAgo: number; isUs: boolean };
type RGBA = [number, number, number, number];
type Street = { path: [number, number][] };

const daysAgo = (t: number) => (TODAY.getTime() - t) / DAY_MS;

export function binActions(actions: Action[], current: Set<string>): Hex[] {
  const bins = new Map<string, Hex>();
  for (const a of actions) {
    const hex = latLngToCell(a.lngLat[1], a.lngLat[0], HEX_RESOLUTION);
    const age = daysAgo(a.time);
    const isUs = current.has(a.companionshipId);
    const b = bins.get(hex);
    if (!b) {
      bins.set(hex, { hex, count: 1, daysAgo: age, isUs });
    } else {
      b.count += 1;
      // Column colour follows the most recent action in the cell.
      if (age < b.daysAgo) {
        b.daysAgo = age;
        b.isUs = isUs;
      }
    }
  }
  return [...bins.values()];
}

const colorFor = (isUs: boolean, age: number): RGB => ageColor(isUs ? US : PREV, age);

// In interleaved mode deck.gl reads `beforeId` to slot layers into the
// Mapbox layer stack, but LayerProps does not declare it.
const under = (beforeId?: string) => ({ beforeId }) as object;

/** Walked once, a few times, or often. Thresholds come from the data. */
export type Level = 1 | 2 | 3;

export function levelThreshold(segments: Segment[]) {
  const repeat = segments.map((s) => s.count).filter((c) => c >= 2).sort((a, b) => a - b);
  if (!repeat.length) return 3;
  // Top 30% of repeat-walked streets count as "often".
  return Math.max(3, repeat[Math.floor(repeat.length * 0.7)]);
}

export const levelOf = (count: number, often: number): Level => (count <= 1 ? 1 : count >= often ? 3 : 2);

// Widths in metres, clamped to a pixel range per level so the three levels
// stay distinct at every zoom and never swell into neighbouring streets.
// Each level is its own layer because the clamp applies per layer.
type Style = { w: number; min: number; max: number; a: number };
const CORE: Record<Level, Style> = {
  1: { w: 2, min: 0.8, max: 1.5, a: 110 },
  2: { w: 5, min: 1.6, max: 3, a: 215 },
  3: { w: 9, min: 2.6, max: 5, a: 255 },
};
const GLOW: Record<2 | 3, Style> = {
  2: { w: 10, min: 3, max: 6, a: 30 },
  3: { w: 18, min: 4.5, max: 9, a: 60 },
};

type Input = {
  streets: Street[];
  segments: Segment[];
  actions: Action[];
  current: Set<string>;
  columns: boolean;
  beforeId?: string;
};

export function buildLayers({ streets, segments, actions, current, columns, beforeId }: Input): Layer[] {
  const often = levelThreshold(segments);
  const level = (s: Segment) => levelOf(s.count, often);
  const segColor = (s: Segment) => colorFor(current.has(s.companionshipId), daysAgo(s.lastTime));

  const byType = (t: ActionType) => actions.filter((a) => a.type === t);
  const dotColor = (d: Action) => colorFor(current.has(d.companionshipId), daysAgo(d.time));
  const dot = (
    id: string,
    data: Action[],
    opts: Partial<ConstructorParameters<typeof ScatterplotLayer<Action>>[0]>,
  ) =>
    new ScatterplotLayer<Action>({
      id,
      data,
      ...under(beforeId),
      pickable: true,
      opacity: 0.55,
      radiusUnits: "meters",
      radiusMinPixels: 1,
      radiusMaxPixels: 5,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1,
      antialiasing: true,
      getPosition: (d) => d.lngLat,
      ...opts,
    });

  const layers: Layer[] = [
    // Every street in the area, faint, so unwalked ones still read as streets.
    new PathLayer<Street>({
      id: "streets",
      data: streets,
      ...under(beforeId),
      widthUnits: "meters",
      widthMinPixels: 1,
      getWidth: 2.5,
      getColor: [74, 74, 80, 150],
      getPath: (d) => d.path,
    }),
  ];

  if (columns) {
    const hexes = binActions(actions, current);
    // Busiest cell tops out around 110 m, whatever the data volume.
    const tallest = Math.max(1, ...hexes.map((h) => h.count));
    layers.push(
      new H3HexagonLayer<Hex>({
        id: "hex-columns",
        data: hexes,
        ...under(beforeId),
        extruded: true,
        opacity: 0.5,
        coverage: 0.42,
        elevationScale: 110 / tallest,
        getHexagon: (d) => d.hex,
        getElevation: (d) => d.count,
        getFillColor: (d) => colorFor(d.isUs, d.daysAgo),
        material: { ambient: 0.55, diffuse: 0.6, shininess: 24, specularColor: [40, 40, 40] },
      }),
    );
  }

  // Walked streets: a soft glow for repeat visits under a core line whose
  // width and opacity step up with each level.
  const byLevel: Record<Level, Segment[]> = { 1: [], 2: [], 3: [] };
  for (const s of segments) byLevel[level(s)].push(s);
  const walked = (id: string, data: Segment[], style: Style) =>
    new PathLayer<Segment>({
      id,
      data,
      ...under(beforeId),
      widthUnits: "meters",
      widthMinPixels: style.min,
      widthMaxPixels: style.max,
      jointRounded: true,
      capRounded: true,
      getPath: (d) => d.path,
      getWidth: style.w,
      getColor: (d) => [...segColor(d), style.a] as RGBA,
    });

  layers.push(
    walked("walk-glow-few", byLevel[2], GLOW[2]),
    walked("walk-glow-often", byLevel[3], GLOW[3]),
    walked("walk-core-once", byLevel[1], CORE[1]),
    walked("walk-core-few", byLevel[2], CORE[2]),
    walked("walk-core-often", byLevel[3], CORE[3]),
    // Actions: tiny marks on the walked streets.
    dot("actions-knock", byType("knock"), {
      filled: true,
      stroked: false,
      getRadius: 2.2,
      getFillColor: dotColor,
    }),
    dot("actions-contact", byType("contact"), {
      filled: false,
      stroked: true,
      getRadius: 3.4,
      getLineWidth: 1,
      getLineColor: dotColor,
    }),
    dot("actions-lesson", byType("lesson"), {
      filled: true,
      stroked: true,
      getRadius: 3.4,
      getLineWidth: 1,
      getFillColor: dotColor,
      getLineColor: [244, 244, 245],
    }),
  );

  return layers;
}
