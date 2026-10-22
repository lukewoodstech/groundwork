// Checks the generated data against the spec. Run with `npm run validate`.

import fs from "node:fs";
import path from "node:path";
import * as turf from "@turf/turf";
import { DAY_MS, RANGE_DAYS, TODAY } from "../lib/data/area";
import type { Action, Appointment, Area, Companionship, Walk, Zone } from "../lib/data/types";

const DIR = path.join(process.cwd(), "public", "data");
const load = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8"));

const area = load<Area>("area");
const companionships = load<Companionship[]>("companionships");
const walks = load<Walk[]>("walks");
const actions = load<Action[]>("actions");
const appointments = load<Appointment[]>("appointments");
const zones = load<Zone[]>("zones");
const streets = load<{ name: string; path: [number, number][] }[]>("streets");
const planted = load<{
  neglectedZoneId: string;
  nearbyZoneId: string;
  slumpCompanionshipId: string;
  successStreet: { name: string; line: [number, number][][] };
}>("planted");

const failures: string[] = [];
const check = (ok: boolean, msg: string) => {
  if (!ok) failures.push(msg);
};

// Points on the boundary count as inside, with a metre of slack for rounding.
const areaPoly = turf.polygon([[...area.polygon, area.polygon[0]]]);
const slack = turf.buffer(areaPoly, 2, { units: "meters" })!;
const inside = (p: [number, number]) => turf.booleanPointInPolygon(p, slack);
const daysAgo = (t: number) => (TODAY.getTime() - t) / DAY_MS;

// 1. Everything stays inside the area.
check(walks.every((w) => w.path.every(inside)), "walk point outside the area");
check(actions.every((a) => inside(a.lngLat)), "action outside the area");
check(zones.every((z) => z.polygon.every(inside)), "zone vertex outside the area");
check(appointments.every((a) => inside(a.lngLat)), "appointment outside the area");
check(streets.every((s) => s.path.every(inside)), "street point outside the area");
check(zones.length >= 5 && zones.length <= 8, `expected 5 to 8 zones, got ${zones.length}`);

// 2. Walk timestamps ascend.
check(
  walks.every(
    (w) => w.path.length === w.timestamps.length && w.timestamps.every((t, i) => i === 0 || t > w.timestamps[i - 1]),
  ),
  "walk timestamps are not strictly ascending",
);

// 3. Actions belong to a real walk and companionship, inside the walk's time.
const walkById = new Map(walks.map((w) => [w.id, w]));
const compIds = new Set(companionships.map((c) => c.id));
check(
  actions.every((a) => {
    const w = walkById.get(a.walkId);
    return (
      !!w &&
      compIds.has(a.companionshipId) &&
      w.companionshipId === a.companionshipId &&
      a.time >= w.timestamps[0] &&
      a.time <= w.timestamps[w.timestamps.length - 1]
    );
  }),
  "action does not belong to a valid walk and companionship",
);

// 4. Companionship coverage has no gaps.
const sorted = [...companionships].sort((a, b) => a.start.localeCompare(b.start));
check(daysAgo(new Date(sorted[0].start).getTime()) >= RANGE_DAYS - 1, "first companionship starts too late");
check(
  sorted.every((c, i) => i === 0 || sorted[i - 1].end === c.start),
  "gap between companionships",
);
check(sorted[sorted.length - 1].end === null && sorted[sorted.length - 1].isCurrent, "last companionship is not current");

// 5. Planted patterns.
const zonePoly = (z: Zone) => turf.polygon([[...z.polygon, z.polygon[0]]]);
const inZone = (z: Zone) => {
  const poly = zonePoly(z);
  return actions.filter((a) => turf.booleanPointInPolygon(a.lngLat, poly));
};

const neglected = zones.find((z) => z.id === planted.neglectedZoneId);
const neglectedActions = neglected ? inZone(neglected) : [];
check(
  neglectedActions.length > 0 && neglectedActions.every((a) => daysAgo(a.time) >= 90),
  "neglected zone should have old work and nothing in the last 90 days",
);

const nearby = zones.find((z) => z.id === planted.nearbyZoneId);
const at2pm = appointments.find((a) => new Date(a.time).getUTCHours() === 20); // 14:00 MDT
check(!!nearby && inZone(nearby).length === 0, "nearby zone should be untouched");
check(
  !!nearby &&
    !!at2pm &&
    turf.pointToLineDistance(at2pm.lngLat, turf.polygonToLine(zonePoly(nearby)) as GeoJSON.Feature<GeoJSON.LineString>, {
      units: "meters",
    }) <= 800,
  "2pm appointment should be within a 10 minute walk of the nearby zone",
);

const streetLines = planted.successStreet.line.map((l) => turf.lineString(l));
const nearStreet = (a: Action) =>
  streetLines.some((l) => turf.pointToLineDistance(a.lngLat, l, { units: "meters" }) < 18);
const recentContacts = actions.filter((a) => a.type === "contact" && daysAgo(a.time) <= 30);
const onStreet = recentContacts.filter(nearStreet);
const rate = (list: Action[]) => list.filter((a) => a.outcome === "lesson_set").length / Math.max(1, list.length);
check(
  onStreet.length >= 4 && rate(onStreet) >= 0.4 && rate(onStreet) > rate(recentContacts.filter((a) => !nearStreet(a))) * 2,
  `success street should convert contacts to lessons (${onStreet.length} contacts, rate ${rate(onStreet).toFixed(2)})`,
);

const slump = companionships.find((c) => c.id === planted.slumpCompanionshipId);
if (slump) {
  const start = daysAgo(new Date(slump.start).getTime());
  const count = (from: number, to: number) => actions.filter((a) => daysAgo(a.time) <= from && daysAgo(a.time) > to).length;
  const before = count(start + 14, start);
  const after = count(start, start - 14);
  check(after < before * 0.5, `coverage should drop after the ${slump.name} transfer (${before} before, ${after} after)`);
}

// Report.
if (failures.length) {
  console.error("Validation failed:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `ok: ${walks.length} walks, ${actions.length} actions, ${zones.length} zones, ${appointments.length} appointments`,
);
