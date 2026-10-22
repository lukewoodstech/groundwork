// Synthetic six months of missionary work in Edgemont, on real streets.
// Run with `npm run generate`. Deterministic for a fixed seed and the cached
// OSM extract in scripts/data/osm-roads.json.

import fs from "node:fs";
import path from "node:path";
import * as turf from "@turf/turf";
import { AREA } from "./area";
import { DAY_MS, RANGE_DAYS, TODAY } from "../lib/data/area";
import type {
  Action,
  ActionType,
  Appointment,
  Companionship,
  Outcome,
  Walk,
  Zone,
} from "../lib/data/types";

const OUT = path.join(process.cwd(), "public", "data");
const SEED = 20261022;

// ---------------------------------------------------------------- random

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + rand() * (b - a);

// ---------------------------------------------------------------- streets

type OsmNode = { type: "node"; id: number; lat: number; lon: number };
type OsmWay = { type: "way"; id: number; nodes: number[]; tags: Record<string, string> };
type LngLat = [number, number];
type Edge = { a: number; b: number; len: number; street: string; kind: string };

const WALKABLE = new Set(["residential", "living_street", "unclassified", "tertiary"]);
const areaPoly = turf.polygon([[...AREA.polygon, AREA.polygon[0]]]);
const inside = (p: LngLat) => turf.booleanPointInPolygon(p, areaPoly);

const osm = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "data", "osm-roads.json"), "utf8"),
) as { elements: (OsmNode | OsmWay)[] };

const coord = new Map<number, LngLat>();
for (const e of osm.elements) {
  if (e.type === "node") coord.set(e.id, [+e.lon.toFixed(6), +e.lat.toFixed(6)]);
}

const adj = new Map<number, Edge[]>();
function link(n: number, e: Edge) {
  const list = adj.get(n);
  if (list) list.push(e);
  else adj.set(n, [e]);
}
for (const e of osm.elements) {
  if (e.type !== "way" || !WALKABLE.has(e.tags.highway)) continue;
  const street = e.tags.name ?? "Unnamed street";
  for (let i = 1; i < e.nodes.length; i++) {
    const a = e.nodes[i - 1];
    const b = e.nodes[i];
    const pa = coord.get(a);
    const pb = coord.get(b);
    if (!pa || !pb || !inside(pa) || !inside(pb)) continue;
    const edge = { a, b, len: turf.distance(pa, pb, { units: "meters" }), street, kind: e.tags.highway };
    link(a, edge);
    link(b, edge);
  }
}

// Every walkable street inside the area, as runs of consecutive inside nodes,
// so the map can draw the ones nobody has walked.
const streets: { name: string; path: LngLat[] }[] = [];
for (const e of osm.elements) {
  if (e.type !== "way" || !WALKABLE.has(e.tags.highway)) continue;
  const name = e.tags.name ?? "Unnamed street";
  let run: LngLat[] = [];
  for (const id of e.nodes) {
    const p = coord.get(id);
    if (p && inside(p)) {
      run.push(p);
    } else {
      if (run.length > 1) streets.push({ name, path: run });
      run = [];
    }
  }
  if (run.length > 1) streets.push({ name, path: run });
}

// Drop tiny disconnected fragments so walks never get stranded. University
// Avenue splits the network, so there is more than one real component.
const seen = new Set<number>();
const keep = new Set<number>();
for (const start of adj.keys()) {
  if (seen.has(start)) continue;
  const comp: number[] = [];
  const stack = [start];
  seen.add(start);
  while (stack.length) {
    const n = stack.pop()!;
    comp.push(n);
    for (const e of adj.get(n)!) {
      const o = e.a === n ? e.b : e.a;
      if (!seen.has(o)) {
        seen.add(o);
        stack.push(o);
      }
    }
  }
  if (comp.length >= 40) for (const n of comp) keep.add(n);
}
for (const n of [...adj.keys()]) if (!keep.has(n)) adj.delete(n);
const nodes = [...adj.keys()];

// ---------------------------------------------------------------- zones

const SEEDS: { id: string; name: string; at: LngLat }[] = [
  { id: "marrcrest", name: "Marrcrest", at: [-111.6625, 40.2735] },
  { id: "stone-gate", name: "Stone Gate", at: [-111.6625, 40.2895] },
  { id: "edgewood", name: "Edgewood", at: [-111.6548, 40.2745] },
  { id: "timpview", name: "Timpview", at: [-111.647, 40.2735] },
  { id: "edgemont", name: "Edgemont", at: [-111.6465, 40.2855] },
  { id: "osmond", name: "Osmond", at: [-111.6445, 40.2955] },
  { id: "indian-hills", name: "Indian Hills", at: [-111.6395, 40.2695] },
  { id: "little-rock", name: "Little Rock", at: [-111.6362, 40.2835] },
];

const areaBbox = turf.bbox(areaPoly);
const cells = turf.voronoi(turf.featureCollection(SEEDS.map((s) => turf.point(s.at))), {
  bbox: [areaBbox[0] - 0.01, areaBbox[1] - 0.01, areaBbox[2] + 0.01, areaBbox[3] + 0.01],
});

const zones: Zone[] = SEEDS.map((s) => {
  const cell = cells.features.find((c) => c && turf.booleanPointInPolygon(s.at, c));
  if (!cell) throw new Error(`No voronoi cell for ${s.id}`);
  const clipped = turf.intersect(turf.featureCollection([cell, areaPoly]));
  if (!clipped) throw new Error(`Zone ${s.id} is outside the area`);
  const rings =
    clipped.geometry.type === "Polygon"
      ? [clipped.geometry.coordinates]
      : clipped.geometry.coordinates;
  const outer = rings
    .map((r) => r[0])
    .sort((a, b) => turf.area(turf.polygon([b])) - turf.area(turf.polygon([a])))[0];
  const polygon = outer.slice(0, -1).map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)] as LngLat);
  return { id: s.id, name: s.name, polygon };
});
const zonePolys = new Map(zones.map((z) => [z.id, turf.polygon([[...z.polygon, z.polygon[0]]])]));

const nodeZone = new Map<number, string>();
for (const n of nodes) {
  const p = coord.get(n)!;
  const z = zones.find((z) => turf.booleanPointInPolygon(p, zonePolys.get(z.id)!));
  nodeZone.set(
    n,
    z?.id ??
      SEEDS.map((s) => ({ id: s.id, d: turf.distance(p, s.at) })).sort((a, b) => a.d - b.d)[0].id,
  );
}
const zoneNodes = new Map<string, number[]>();
for (const [n, z] of nodeZone) zoneNodes.set(z, [...(zoneNodes.get(z) ?? []), n]);

// ---------------------------------------------------------------- planted patterns

const NEGLECTED = "stone-gate"; // nobody since the first transfer
const NEARBY = "little-rock"; // never walked, close to the 2pm appointment
const SUCCESS_ZONE = "timpview"; // one street here converts contacts to lessons
const SLUMP = "c3"; // coverage drops for two weeks after this transfer
const NEGLECT_DAYS = 96;

// Success street: the longest residential street inside the success zone.
const streetLen = new Map<string, number>();
for (const n of zoneNodes.get(SUCCESS_ZONE) ?? []) {
  for (const e of adj.get(n)!) {
    if (e.kind !== "residential" || e.street === "Unnamed street") continue;
    if (nodeZone.get(e.a) !== SUCCESS_ZONE || nodeZone.get(e.b) !== SUCCESS_ZONE) continue;
    streetLen.set(e.street, (streetLen.get(e.street) ?? 0) + e.len / 2);
  }
}
const SUCCESS_STREET = [...streetLen.entries()].sort((a, b) => b[1] - a[1])[0][0];
const successNodes = nodes.filter((n) => adj.get(n)!.some((e) => e.street === SUCCESS_STREET));
const successLine = turf.multiLineString(
  [...new Set(nodes.flatMap((n) => adj.get(n)!.filter((e) => e.street === SUCCESS_STREET)))].map(
    (e) => [coord.get(e.a)!, coord.get(e.b)!],
  ),
);

// ---------------------------------------------------------------- companionships

const dayISO = (daysAgo: number) =>
  new Date(TODAY.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);
const daysAgoOf = (iso: string) => Math.round((TODAY.getTime() - new Date(iso).getTime()) / DAY_MS);

const companionships: Companionship[] = [
  { id: "c1", name: "Elders Park & Ruiz", start: dayISO(RANGE_DAYS), end: dayISO(138), isCurrent: false },
  { id: "c2", name: "Elders Ruiz & Okafor", start: dayISO(138), end: dayISO(96), isCurrent: false },
  { id: "c3", name: "Elders Okafor & Lund", start: dayISO(96), end: dayISO(48), isCurrent: false },
  { id: "us", name: "Us", start: dayISO(48), end: null, isCurrent: true },
];

const compFor = (daysAgo: number) =>
  companionships.find(
    (c) => daysAgo <= daysAgoOf(c.start) && (c.end === null || daysAgo > daysAgoOf(c.end)),
  )!;

// Every companionship leans on a couple of zones. The first pair worked the
// zone that is neglected now.
const FAVOURITES: Record<string, string[]> = {
  c1: ["stone-gate", "marrcrest"],
  c2: ["edgemont", "osmond"],
  c3: ["timpview", "indian-hills"],
  us: ["timpview", "edgewood"],
};

function allowedZone(zoneId: string, daysAgo: number) {
  if (zoneId === NEARBY) return false;
  if (zoneId === NEGLECTED && daysAgo < NEGLECT_DAYS) return false;
  return true;
}

const zoneAt = (p: LngLat) =>
  [NEGLECTED, NEARBY].find((id) => turf.booleanPointInPolygon(p, zonePolys.get(id)!));

function pickZone(comp: Companionship, daysAgo: number) {
  const fav = FAVOURITES[comp.id];
  const pool = zones.map((z) => z.id).filter((id) => allowedZone(id, daysAgo));
  if (rand() < 0.6) {
    const f = fav.filter((id) => pool.includes(id));
    if (f.length) return pick(f);
  }
  return pick(pool);
}

// ---------------------------------------------------------------- walks

const walks: Walk[] = [];
const actions: Action[] = [];

const WALK_SPEED = 1.25; // m/s
const DWELL: Record<ActionType, [number, number]> = {
  knock: [60, 180],
  contact: [180, 420],
  lesson: [1200, 2400],
};

function actionType(onSuccessStreet: boolean): ActionType {
  const r = rand();
  if (onSuccessStreet) return r < 0.5 ? "knock" : r < 0.88 ? "contact" : "lesson";
  return r < 0.8 ? "knock" : r < 0.95 ? "contact" : "lesson";
}

function outcomeFor(type: ActionType, onSuccessStreet: boolean): Outcome {
  const r = rand();
  if (type === "lesson") return "lesson_set";
  if (type === "contact") {
    if (onSuccessStreet) return r < 0.75 ? "lesson_set" : r < 0.9 ? "interested" : "none";
    return r < 0.1 ? "lesson_set" : r < 0.35 ? "interested" : "none";
  }
  return r < 0.06 ? "interested" : "none";
}

// Local midnight for a day, from the noon anchor in TODAY.
const dayStart = (daysAgo: number) => TODAY.getTime() - daysAgo * DAY_MS - 12 * 3600_000;

type WalkOpts = {
  comp: Companionship;
  daysAgo: number;
  startHour: number;
  zoneId: string;
  startNode?: number;
  preferStreet?: string;
};

function generateWalk({ comp, daysAgo, startHour, zoneId, startNode, preferStreet }: WalkOpts) {
  const budget = between(2, 4) * 3600;
  const walkId = `w${walks.length}`;
  let t = dayStart(daysAgo) + (startHour * 60 + between(0, 40)) * 60_000;
  let node = startNode ?? pick(zoneNodes.get(zoneId)!);
  const pathPts: LngLat[] = [coord.get(node)!];
  const stamps: number[] = [t];
  const used = new Set<Edge>();
  let prev: Edge | null = null;
  let elapsed = 0;
  let untilNext = between(60, 110);
  const successWindow = daysAgo <= 30;

  while (elapsed < budget) {
    const all = adj.get(node)!;
    let options = all.filter((e) => {
      const o = e.a === node ? e.b : e.a;
      return e !== prev && allowedZone(nodeZone.get(o)!, daysAgo);
    });
    if (!options.length) options = all.filter((e) => allowedZone(nodeZone.get(e.a === node ? e.b : e.a)!, daysAgo));
    if (!options.length) break;

    const prefer = (f: (e: Edge) => boolean, p: number) => {
      const sub = options.filter(f);
      if (sub.length && rand() < p) options = sub;
    };
    if (preferStreet) prefer((e) => e.street === preferStreet, 0.8);
    prefer((e) => !used.has(e), 0.85);
    prefer((e) => nodeZone.get(e.a === node ? e.b : e.a) === zoneId, 0.8);

    const edge = pick(options);
    const other = edge.a === node ? edge.b : edge.a;
    const pa = coord.get(node)!;
    const pb = coord.get(other)!;
    const onSuccess = successWindow && edge.street === SUCCESS_STREET;

    // Doors along this stretch of street.
    let along = 0;
    while (along + untilNext < edge.len) {
      along += untilNext;
      untilNext = between(60, 110);
      const f = along / edge.len;
      const onLine: LngLat = [pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f];
      const side = rand() < 0.5 ? -90 : 90;
      const door = turf.destination(onLine, between(8, 14) / 1000, turf.bearing(pa, pb) + side)
        .geometry.coordinates as LngLat;
      const at = inside(door) ? door : onLine;
      // A door across a zone line must respect that zone's rules too.
      if (!allowedZone(zoneAt(at) ?? zoneId, daysAgo)) continue;
      const type = actionType(onSuccess);
      t += (untilNext / WALK_SPEED) * 1000;
      const dwell = between(...DWELL[type]);
      actions.push({
        id: `a${actions.length}`,
        companionshipId: comp.id,
        walkId,
        type,
        lngLat: [+at[0].toFixed(6), +at[1].toFixed(6)],
        time: Math.round(t + dwell * 500),
        outcome: outcomeFor(type, onSuccess),
      });
      t += dwell * 1000;
      elapsed += untilNext / WALK_SPEED + dwell;
    }
    untilNext -= edge.len - along;
    t += ((edge.len - along) / WALK_SPEED) * 1000;
    elapsed += (edge.len - along) / WALK_SPEED;

    pathPts.push(pb);
    stamps.push(Math.round(t));
    used.add(edge);
    prev = edge;
    node = other;
  }

  if (pathPts.length < 3) return;
  walks.push({ id: walkId, companionshipId: comp.id, date: dayISO(daysAgo), path: pathPts, timestamps: stamps });
}

for (let daysAgo = RANGE_DAYS; daysAgo >= 0; daysAgo--) {
  const comp = compFor(daysAgo);
  const dow = new Date(TODAY.getTime() - daysAgo * DAY_MS).getUTCDay();
  if (dow === 1) continue; // preparation day

  const slump = comp.id === SLUMP && daysAgo > daysAgoOf(comp.start) - 14;
  const r = rand();
  const sessions: number[] = slump
    ? r < 0.3 ? [between(13, 15)] : []
    : r < 0.15 ? [] : r < 0.45 ? [rand() < 0.5 ? between(9.5, 11) : between(13, 15.5)] : [between(9.5, 10.5), between(14, 15.5)];

  for (const startHour of sessions) {
    if (daysAgo === 0 && startHour > 11) continue; // today is still ahead of us
    generateWalk({ comp, daysAgo, startHour, zoneId: pickZone(comp, daysAgo) });
  }
}

// The success street gets worked deliberately through the last month.
for (const daysAgo of [27, 22, 17, 12, 7, 3]) {
  generateWalk({
    comp: compFor(daysAgo),
    daysAgo,
    startHour: between(17, 18),
    zoneId: SUCCESS_ZONE,
    startNode: pick(successNodes),
    preferStreet: SUCCESS_STREET,
  });
}

walks.sort((a, b) => a.timestamps[0] - b.timestamps[0]);
actions.sort((a, b) => a.time - b.time);

// ---------------------------------------------------------------- appointments

const nearbyLine = turf.polygonToLine(zonePolys.get(NEARBY)!);
const nearbyCandidates = nodes.filter((n) => {
  if (nodeZone.get(n) === NEARBY) return false;
  const d = turf.pointToLineDistance(coord.get(n)!, nearbyLine as GeoJSON.Feature<GeoJSON.LineString>, { units: "meters" });
  return d > 250 && d < 600;
});
// The other two appointments sit well away from both planted zones, so the
// 2pm lesson is unambiguously the close one and nothing else looks "nearby".
const farFrom = (zoneId: string, p: LngLat) =>
  turf.pointToLineDistance(p, turf.polygonToLine(zonePolys.get(zoneId)!) as GeoJSON.Feature<GeoJSON.LineString>, {
    units: "meters",
  }) > 900;
const otherNodes = nodes.filter((n) => {
  const z = nodeZone.get(n);
  const p = coord.get(n)!;
  return z !== NEARBY && z !== NEGLECTED && farFrom(NEARBY, p) && farFrom(NEGLECTED, p);
});
const todayAt = (h: number, m: number) => new Date(dayStart(0) + (h * 60 + m) * 60_000).toISOString();

const appointments: Appointment[] = [
  { id: "ap1", time: todayAt(10, 30), label: "Follow-up with Maria", lngLat: coord.get(pick(otherNodes))! },
  { id: "ap2", time: todayAt(14, 0), label: "Lesson with the Sorensens", lngLat: coord.get(pick(nearbyCandidates))! },
  { id: "ap3", time: todayAt(16, 30), label: "Dinner with the Halls", lngLat: coord.get(pick(otherNodes))! },
];

// ---------------------------------------------------------------- write

fs.mkdirSync(OUT, { recursive: true });
const write = (name: string, data: unknown) =>
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data));

write("area", AREA);
write("companionships", companionships);
write("walks", walks);
write("actions", actions);
write("appointments", appointments);
write("zones", zones);
write("streets", streets);
write("planted", {
  neglectedZoneId: NEGLECTED,
  nearbyZoneId: NEARBY,
  slumpCompanionshipId: SLUMP,
  successStreet: { name: SUCCESS_STREET, line: successLine.geometry.coordinates },
});

console.log(
  `${nodes.length} street nodes, ${streets.length} street runs, ${zones.length} zones, ${walks.length} walks, ${actions.length} actions`,
);
console.log(`success street: ${SUCCESS_STREET}`);
