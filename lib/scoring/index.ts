import { booleanPointInPolygon, distance, pointToLineDistance, polygon, polygonToLine } from "@turf/turf";
import { DAY_MS, TODAY } from "@/lib/data/area";
import type { Action, Appointment, Street, Zone } from "@/lib/data/types";

export type SuggestionType = "NEARBY" | "REPEAT_WHAT_WORKED" | "NEGLECTED";

export type Candidate = {
  zoneId: string;
  name: string;
  /** Days since anyone worked the zone, or null if nobody ever has. */
  daysSinceLast: number | null;
  actionsAllTime: number;
  contacts60: number;
  lessonsFromContacts60: number;
  /** Share of contacts in the last 60 days that became lessons. */
  rate60: number | null;
  /** Best street in the zone over the last 30 days, by lessons from contacts. */
  topStreet: { name: string; contacts: number; lessons: number } | null;
  nearest: { appointmentId: string; label: string; time: string; walkMinutes: number };
  signals: { neglect: number; success: number; proximity: number };
  score: number;
  suggestedType: SuggestionType;
};

export type Suggestion = { zoneId: string; type: SuggestionType; reason: string };

const WALK_M_PER_MIN = 80;
const DETOUR = 1.3; // streets are not straight lines

const daysAgo = (t: number) => (TODAY.getTime() - t) / DAY_MS;

type Input = { zones: Zone[]; actions: Action[]; appointments: Appointment[]; streets: Street[] };

/** Rank every zone on neglect, recent success and proximity. Returns the top 6. */
export function scoreZones({ zones, actions, appointments, streets }: Input): Candidate[] {
  const out = zones.map((zone) => {
    const poly = polygon([[...zone.polygon, zone.polygon[0]]]);
    const inZone = actions.filter((a) => booleanPointInPolygon(a.lngLat, poly));
    const last = inZone.reduce((m, a) => Math.max(m, a.time), 0);
    const daysSinceLast = inZone.length ? Math.floor(daysAgo(last)) : null;

    const contacts60 = inZone.filter((a) => a.type === "contact" && daysAgo(a.time) <= 60);
    const lessons60 = contacts60.filter((a) => a.outcome === "lesson_set").length;
    const rate60 = contacts60.length >= 3 ? lessons60 / contacts60.length : null;

    // Streets that run through the zone, with last month's contacts snapped on.
    const zoneStreets = streets.filter((s) => s.path.some((p) => booleanPointInPolygon(p, poly)));
    const byStreet = new Map<string, { contacts: number; lessons: number }>();
    for (const a of contacts60.filter((a) => daysAgo(a.time) <= 30)) {
      const street = nearestStreet(a.lngLat, zoneStreets);
      if (!street) continue;
      const row = byStreet.get(street) ?? { contacts: 0, lessons: 0 };
      row.contacts += 1;
      if (a.outcome === "lesson_set") row.lessons += 1;
      byStreet.set(street, row);
    }
    const topStreet = [...byStreet.entries()]
      .map(([name, r]) => ({ name, ...r }))
      .sort((a, b) => b.lessons - a.lessons || b.contacts - a.contacts)[0] ?? null;

    const edge = polygonToLine(poly) as GeoJSON.Feature<GeoJSON.LineString>;
    const nearest = appointments
      .map((ap) => {
        const metres = booleanPointInPolygon(ap.lngLat, poly)
          ? 0
          : pointToLineDistance(ap.lngLat, edge, { units: "meters" });
        return {
          appointmentId: ap.id,
          label: ap.label,
          time: ap.time,
          walkMinutes: Math.max(1, Math.round((metres * DETOUR) / WALK_M_PER_MIN)),
        };
      })
      .sort((a, b) => a.walkMinutes - b.walkMinutes)[0];

    const neglect = daysSinceLast === null ? 1 : Math.min(daysSinceLast, 120) / 120;
    const success = rate60 === null ? 0 : rate60 * Math.min(1, contacts60.length / 6);
    const proximity = Math.max(0, 1 - nearest.walkMinutes / 25);
    const signals = { neglect, success, proximity };
    const score = 0.4 * neglect + 0.35 * success + 0.25 * proximity;

    const suggestedType: SuggestionType =
      success >= neglect && success >= proximity
        ? "REPEAT_WHAT_WORKED"
        : proximity > neglect && nearest.walkMinutes <= 12
          ? "NEARBY"
          : "NEGLECTED";

    return {
      zoneId: zone.id,
      name: zone.name,
      daysSinceLast,
      actionsAllTime: inZone.length,
      contacts60: contacts60.length,
      lessonsFromContacts60: lessons60,
      rate60,
      topStreet,
      nearest,
      signals,
      score,
      suggestedType,
    } satisfies Candidate;
  });

  // Top 6 by score, but the strongest zone on each signal is always in.
  const ranked = out.sort((a, b) => b.score - a.score);
  const must = (["neglect", "success", "proximity"] as const).map(
    (k) => [...ranked].sort((a, b) => b.signals[k] - a.signals[k])[0],
  );
  const chosen = new Set<Candidate>(must);
  for (const c of ranked) {
    if (chosen.size >= 6) break;
    chosen.add(c);
  }
  return ranked.filter((c) => chosen.has(c));
}

function nearestStreet(p: [number, number], streets: Street[]): string | null {
  let best: { name: string; d: number } | null = null;
  for (const s of streets) {
    // Cheap reject: skip runs whose every point is more than ~60 m away.
    if (!s.path.some((q) => Math.abs(q[0] - p[0]) < 0.0008 && Math.abs(q[1] - p[1]) < 0.0006)) continue;
    const d = s.path.length > 1
      ? pointToLineDistance(p, { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: s.path } }, { units: "meters" })
      : distance(p, s.path[0], { units: "meters" });
    if (d < 20 && (!best || d < best.d)) best = { name: s.name, d };
  }
  return best?.name ?? null;
}

const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Templated reason for a candidate, in the voice of the AI suggestions. */
export function templatedReason(c: Candidate, type: SuggestionType): string {
  const idle =
    c.daysSinceLast === null
      ? `Nobody has worked ${c.name} in the last six months`
      : c.daysSinceLast === 0
        ? `${c.name} was worked today`
        : `Nobody has worked ${c.name} in ${c.daysSinceLast} day${c.daysSinceLast === 1 ? "" : "s"}`;
  switch (type) {
    case "NEARBY":
      return `${c.nearest.walkMinutes} min walk from your ${clockTime(c.nearest.time)} ${lowerFirst(c.nearest.label)}. ${idle}.`;
    case "REPEAT_WHAT_WORKED":
      return c.topStreet
        ? `${c.topStreet.contacts} street contacts on ${c.topStreet.name} last month, ${c.topStreet.lessons} became lessons.`
        : `${c.contacts60} street contacts in ${c.name} in the last 60 days, ${c.lessonsFromContacts60} became lessons.`;
    default:
      return `${idle}. ${c.actionsAllTime} actions there all time.`;
  }
}

/**
 * Deterministic plan. Nearby is the least-worked zone within a short walk of
 * an appointment, repeat is the best lesson rate, neglected is the longest idle.
 */
export function fallbackPlan(candidates: Candidate[]): Suggestion[] {
  const taken = new Set<string>();
  const pick = (type: SuggestionType, order: (a: Candidate, b: Candidate) => number, filter?: (c: Candidate) => boolean) => {
    const pool = candidates.filter((c) => !taken.has(c.zoneId));
    const best = [...pool].filter(filter ?? (() => true)).sort(order)[0] ?? [...pool].sort(order)[0];
    if (!best) return null;
    taken.add(best.zoneId);
    return { zoneId: best.zoneId, type, reason: templatedReason(best, type) };
  };
  return [
    pick(
      "NEARBY",
      (a, b) => b.signals.neglect - a.signals.neglect || a.nearest.walkMinutes - b.nearest.walkMinutes,
      (c) => c.nearest.walkMinutes <= 12,
    ),
    pick("REPEAT_WHAT_WORKED", (a, b) => b.signals.success - a.signals.success),
    pick("NEGLECTED", (a, b) => b.signals.neglect - a.signals.neglect),
  ].filter((s): s is Suggestion => s !== null);
}

/** Every number a reason could legitimately cite for a candidate. */
export function citableNumbers(c: Candidate): number[] {
  return [
    c.daysSinceLast,
    c.actionsAllTime,
    c.contacts60,
    c.lessonsFromContacts60,
    c.topStreet?.contacts,
    c.topStreet?.lessons,
    c.nearest.walkMinutes,
    c.rate60 === null ? null : Math.round(c.rate60 * 100),
  ].filter((n): n is number => typeof n === "number");
}

/** True when the suggestions name real candidates, use valid labels, and cite real numbers. */
export function validPlan(suggestions: unknown, candidates: Candidate[]): suggestions is Suggestion[] {
  if (!Array.isArray(suggestions) || suggestions.length !== 3) return false;
  const seen = new Set<string>();
  return suggestions.every((s) => {
    if (!s || typeof s !== "object") return false;
    const { zoneId, type, reason } = s as Record<string, unknown>;
    const c = candidates.find((c) => c.zoneId === zoneId);
    if (!c || seen.has(c.zoneId)) return false;
    seen.add(c.zoneId);
    if (type !== "NEARBY" && type !== "REPEAT_WHAT_WORKED" && type !== "NEGLECTED") return false;
    if (typeof reason !== "string" || reason.length < 10 || reason.length > 280) return false;
    const numbers = reason.match(/\d+/g)?.map(Number) ?? [];
    const cited = citableNumbers(c);
    return numbers.length > 0 && numbers.some((n) => cited.includes(n));
  });
}
