import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { latLngToCell } from "h3-js";
import { ageColor, PREV, US, type RGB } from "@/lib/colors";
import { DAY_MS, TODAY } from "@/lib/data/area";
import type { Action, ActionType } from "@/lib/data/types";

export const HEX_RESOLUTION = 10;

type Hex = { hex: string; count: number; daysAgo: number; isUs: boolean };

const daysAgo = (a: Action) => (TODAY.getTime() - a.time) / DAY_MS;

export function binActions(actions: Action[], current: Set<string>): Hex[] {
  const bins = new Map<string, Hex>();
  for (const a of actions) {
    const hex = latLngToCell(a.lngLat[1], a.lngLat[0], HEX_RESOLUTION);
    const age = daysAgo(a);
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

export function buildLayers(
  actions: Action[],
  current: Set<string>,
  beforeId?: string,
): Layer[] {
  const hexes = binActions(actions, current);
  const byType = (t: ActionType) => actions.filter((a) => a.type === t);

  const marker = (
    id: string,
    data: Action[],
    opts: Partial<ConstructorParameters<typeof ScatterplotLayer<Action>>[0]>,
  ) =>
    new ScatterplotLayer<Action>({
      id,
      data,
      ...under(beforeId),
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      antialiasing: true,
      getPosition: (d) => d.lngLat,
      ...opts,
    });

  return [
    new H3HexagonLayer<Hex>({
      id: "hex-columns",
      data: hexes,
      ...under(beforeId),
      extruded: true,
      coverage: 0.42,
      elevationScale: 22,
      getHexagon: (d) => d.hex,
      getElevation: (d) => d.count,
      getFillColor: (d) => colorFor(d.isUs, d.daysAgo),
      material: {
        ambient: 0.55,
        diffuse: 0.6,
        shininess: 24,
        specularColor: [40, 40, 40],
      },
    }),
    // Door knocks: small filled dots.
    marker("knocks", byType("knock"), {
      filled: true,
      stroked: false,
      getRadius: 2.6,
      getFillColor: (d) => colorFor(current.has(d.companionshipId), daysAgo(d)),
    }),
    // Street contacts: open rings.
    marker("contacts", byType("contact"), {
      filled: false,
      stroked: true,
      getRadius: 4.5,
      getLineWidth: 1.5,
      getLineColor: (d) => colorFor(current.has(d.companionshipId), daysAgo(d)),
    }),
    // Lessons: filled dot with a white ring.
    marker("lessons", byType("lesson"), {
      filled: true,
      stroked: true,
      getRadius: 4.5,
      getLineWidth: 1.5,
      getFillColor: (d) => colorFor(current.has(d.companionshipId), daysAgo(d)),
      getLineColor: [244, 244, 245],
    }),
  ];
}
