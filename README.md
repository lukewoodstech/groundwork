# Groundwork

Groundwork is a 3D map for missionary companionships that shows where they, and the companionships before them, have walked and worked in their area over the last six months, then suggests where to work today. Walked streets glow by how often they were covered and fade as the work ages, so a street knocked months ago reads as new ground again. A "Plan my day" button ranks the area's zones on neglect, recent success, and walking distance to today's appointments, asks Claude to pick three places with a one-sentence reason each, and draws the walking route from the nearest appointment. History, not surveillance: there are no live locations and no individual tracking.

**Live:** deploying to Vercel, link to follow

## Stack

- Next.js (App Router), TypeScript, Tailwind
- Mapbox GL JS v3 for the basemap and walking directions
- deck.gl via `MapboxOverlay` for walked streets, actions, hex columns, and routes
- h3-js and Turf for spatial work
- Anthropic SDK (Claude) from a server route for suggestions
- Vercel for hosting

## Data

All data is synthetic. `scripts/generate.ts` builds six months of walks and door knocks on real residential streets from an OpenStreetMap extract of the Edgemont neighborhood in Provo, Utah, clipped to a boundary that follows real roads and the Provo River. Four patterns are planted for the planner to find, and `scripts/validate.ts` checks them along with the data's integrity. No real people, visits, or addresses are represented.

```bash
npm run generate   # rebuild public/data/*.json from scripts/data/osm-roads.json
npm run validate   # check bounds, timestamps, references, and planted patterns
```

## Run locally

```bash
cp .env.example .env.local   # add NEXT_PUBLIC_MAPBOX_TOKEN and ANTHROPIC_API_KEY
npm install
npm run dev
```

Without an Anthropic key, Plan my day falls back to the deterministic ranking with templated reasons.
