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

const colorFor = (isUs: boolean, age: number): RGB =>
  ageColor(isUs ? US : PREV, age);

// In interleaved mode deck.gl reads `beforeId` to slot layers into the
// Mapbox layer stack, but LayerProps does not declare it.
const under = (beforeId?: string) => ({ beforeId }) as object;

type Input = {
  segments: Segment[];
  actions: Action[];
  current: Set<string>;
  columns: boolean;
  beforeId?: string;
};

export function buildLayers({ segments, actions, current, columns, beforeId }: Input): Layer[] {
  const maxCount = Math.max(1, ...segments.map((s) => s.count));
  // How often a segment was walked, 0..1, with diminishing returns.
  const freq = (s: Segment) => Math.log1p(s.count) / Math.log1p(maxCount);
  const segColor = (s: Segment) => colorFor(current.has(s.companionshipId), daysAgo(s.lastTime));

  const path = (id: string, opts: Partial<ConstructorParameters<typeof PathLayer<Segment>>[0]>) =>
    new PathLayer<Segment>({
      id,
      data: segments,
      ...under(beforeId),
      widthUnits: "meters",
      jointRounded: true,
      capRounded: true,
      getPath: (d) => d.path,
      ...opts,
    });

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

  const layers: Layer[] = [];

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

  layers.push(
    // Walked streets: a soft wide glow under a bright core.
    // Widths are in metres so the streets stay crisp when zoomed out and
    // thicken naturally as you zoom in.
    path("walk-glow", {
      widthMinPixels: 3,
      getWidth: (d) => 12 + 18 * freq(d),
      getColor: (d) => [...segColor(d), 22 + 40 * freq(d)] as [number, number, number, number],
    }),
    path("walk-core", {
      widthMinPixels: 1.2,
      widthMaxPixels: 6,
      getWidth: (d) => 3.5 + 4 * freq(d),
      getColor: (d) => [...segColor(d), 150 + 105 * freq(d)] as [number, number, number, number],
    }),
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
