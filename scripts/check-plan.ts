// Calls /api/plan five times and checks the planted patterns come back.
// Run with the app up: `npm run check-plan` (PLAN_URL overrides the host).

import fs from "node:fs";
import path from "node:path";
import { fallbackPlan, scoreZones, type Suggestion } from "../lib/scoring";
import type { Action, Appointment, Street, Zone } from "../lib/data/types";

const DIR = path.join(process.cwd(), "public", "data");
const load = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8"));

const zones = load<Zone[]>("zones");
const actions = load<Action[]>("actions");
const appointments = load<Appointment[]>("appointments");
const streets = load<Street[]>("streets");
const planted = load<{
  neglectedZoneId: string;
  nearbyZoneId: string;
  successStreet: { name: string };
}>("planted");

const candidates = scoreZones({ zones, actions, appointments, streets });
console.log(
  "candidates:",
  candidates
    .map((c) => `${c.zoneId} ${c.score.toFixed(2)} ${c.suggestedType}`)
    .join(" | "),
);

const url = `${process.env.PLAN_URL ?? "http://localhost:3100"}/api/plan`;
const runs = Number(process.env.RUNS ?? 5);
let passes = 0;

const matches = (list: Suggestion[]) => {
  const by = (t: string) => list.find((s) => s.type === t)?.zoneId;
  return (
    list.length === 3 &&
    by("NEGLECTED") === planted.neglectedZoneId &&
    by("NEARBY") === planted.nearbyZoneId &&
    by("REPEAT_WHAT_WORKED") === "timpview"
  );
};

const local = fallbackPlan(candidates);
console.log(`\nlocal fallback ${matches(local) ? "matches" : "DOES NOT match"} planted patterns`);
for (const s of local) console.log(`  ${s.type.padEnd(18)} ${s.zoneId.padEnd(12)} ${s.reason}`);

async function main() {
  for (let i = 1; i <= runs; i++) {
    const started = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidates, appointments }),
    });
    const data = (await res.json()) as {
      source: string;
      note?: string;
      suggestions: Suggestion[];
    };
    const ok = matches(data.suggestions);
    if (ok) passes += 1;
    console.log(
      `\nrun ${i}: ${data.source}${data.note ? ` (${data.note})` : ""} in ${Date.now() - started}ms, ${ok ? "matches planted patterns" : "DOES NOT match"}`,
    );
    for (const s of data.suggestions)
      console.log(`  ${s.type.padEnd(18)} ${s.zoneId.padEnd(12)} ${s.reason}`);
  }

  console.log(`\n${passes}/${runs} runs matched the planted patterns`);
  process.exit(passes === runs ? 0 : 1);
}

main();
