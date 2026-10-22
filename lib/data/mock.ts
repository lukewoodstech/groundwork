import { DAY_MS, TODAY } from "./area";
import type { Action, ActionType, Companionship, Outcome } from "./types";

// Phase 1 placeholder. Replaced by scripts/generate.ts in Phase 2.
// Points sit on an approximate Provo street grid so columns and markers
// line up with real blocks closely enough to tune the look.

const dayStr = (daysAgo: number) =>
  new Date(TODAY.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);

export const companionships: Companionship[] = [
  { id: "c1", name: "Elders Park & Ruiz", start: dayStr(183), end: dayStr(138), isCurrent: false },
  { id: "c2", name: "Elders Ruiz & Okafor", start: dayStr(138), end: dayStr(96), isCurrent: false },
  { id: "c3", name: "Elders Okafor & Lund", start: dayStr(96), end: dayStr(48), isCurrent: false },
  { id: "us", name: "Us", start: dayStr(48), end: null, isCurrent: true },
];

// Provo grid: University Ave is 0 E, Center St is 0 N.
const LNG0 = -111.6585;
const LAT0 = 40.2338;
const LNG_PER_100E = 0.00183;
const LAT_PER_100N = 0.00146;
const toLngLat = (e: number, n: number): [number, number] => [
  LNG0 + (e / 100) * LNG_PER_100E,
  LAT0 + (n / 100) * LAT_PER_100N,
];

const NS_STREETS = [150, 300, 450, 650, 800, 1000, 1200, 1400]; // E
const EW_STREETS = [2450, 2620, 2780, 2950, 3100, 3230, 3400, 3560, 3700]; // N

// Mulberry32: small, seeded, reproducible.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const compFor = (daysAgo: number) =>
  companionships.find(
    (c) =>
      daysAgo <= daysBetween(c.start) && (c.end === null || daysAgo > daysBetween(c.end)),
  ) ?? companionships[0];

const daysBetween = (iso: string) =>
  Math.round((TODAY.getTime() - new Date(iso).getTime()) / DAY_MS);

function pickType(r: number): ActionType {
  if (r < 0.8) return "knock";
  if (r < 0.95) return "contact";
  return "lesson";
}

function outcomeFor(type: ActionType, r: number): Outcome {
  if (type === "lesson") return "lesson_set";
  if (type === "contact") return r < 0.35 ? "interested" : "none";
  return r < 0.08 ? "interested" : "none";
}

function build(): Action[] {
  const rand = rng(7);
  const out: Action[] = [];
  const SESSIONS = 22;

  for (let s = 0; s < SESSIONS; s++) {
    const daysAgo = Math.floor(rand() * 183);
    const comp = compFor(daysAgo);
    // Previous elders worked the whole area. We have been working the south-west.
    const eIdx = comp.isCurrent
      ? Math.floor(rand() * 5)
      : Math.floor(rand() * NS_STREETS.length);
    const nIdx = comp.isCurrent
      ? Math.floor(rand() * 5)
      : Math.floor(rand() * EW_STREETS.length);

    // Walk 2 to 4 blocks, alternating along an E-W street then an N-S street.
    let e = NS_STREETS[eIdx];
    let n = EW_STREETS[nIdx];
    const legs = 2 + Math.floor(rand() * 3);
    const startMin = 9 * 60 + Math.floor(rand() * 7 * 60);
    let minute = startMin;

    for (let leg = 0; leg < legs; leg++) {
      const alongE = leg % 2 === 0;
      const dir = rand() < 0.5 ? -1 : 1;
      const e2 = alongE ? clampPick(NS_STREETS, e, dir) : e;
      const n2 = alongE ? n : clampPick(EW_STREETS, n, dir);
      const stops = 3 + Math.floor(rand() * 4);
      for (let i = 1; i <= stops; i++) {
        const f = i / (stops + 1);
        // Doors sit a few metres off the centreline, on either side.
        const side = (rand() < 0.5 ? -1 : 1) * (12 + rand() * 10);
        const ee = e + (e2 - e) * f + (alongE ? 0 : side);
        const nn = n + (n2 - n) * f + (alongE ? side : 0);
        const type = pickType(rand());
        minute += 6 + Math.floor(rand() * 10);
        const time =
          TODAY.getTime() - daysAgo * DAY_MS - (18 * 60 - minute) * 60_000;
        out.push({
          id: `a${out.length}`,
          companionshipId: comp.id,
          walkId: `w${s}`,
          type,
          lngLat: toLngLat(ee, nn),
          time,
          outcome: outcomeFor(type, rand()),
        });
      }
      e = e2;
      n = n2;
    }
  }
  return out;
}

function clampPick(list: number[], current: number, dir: number) {
  const i = list.indexOf(current);
  const j = Math.min(Math.max(i + dir, 0), list.length - 1);
  return j === i ? list[Math.min(Math.max(i - dir, 0), list.length - 1)] : list[j];
}

export const actions: Action[] = build();
