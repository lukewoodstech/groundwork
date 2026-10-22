# Groundwork: Technical Spec

## Rules for Claude Code
- Read this file before every task.
- Build one phase at a time. Stop after each phase so I can review.
- Don't add features that aren't in this spec.
- Data is static JSON from a generator script. The demo never depends on a live data fetch.
- Run `typecheck`, `lint`, and `build` after every phase and fix anything that fails.
- Keep it simple. When there are two ways to do something, pick the one with less code.

## What it is
A 3D map that shows missionaries where they and the missionaries before them have walked and worked in their area over time, plus an AI that suggests where to work today.

**User:** a companionship that just transferred into a new area.
**Job:** decide where to work today without repeating what's already been done.

**Principles**
- History, not surveillance. No live locations, no individual tracking, homes not identifiable.
- Understandable in 5 seconds.
- Old work fades. A street knocked a year ago is new ground today.
- AI suggests, missionaries decide. Every suggestion shows its reason.

## Stack
| Layer | Tech | Why |
|---|---|---|
| App | Next.js (App Router), TypeScript, Tailwind | Fast to build, deploys to Vercel |
| Basemap | Mapbox GL JS v3 | Real streets, 3D terrain and buildings, dark style |
| Data layers | deck.gl via `MapboxOverlay` (`TripsLayer`, `H3HexagonLayer`, `PathLayer`) | GPU rendering of trails and columns over time |
| Spatial | `h3-js`, `@turf/turf` | Hex binning, distances, area outlines |
| Street data | OpenStreetMap Overpass API (generator only) | Real Provo streets for synthetic walks |
| Routing | Mapbox Directions API, walking profile | Walking route to a suggested area |
| AI | Anthropic SDK (Claude API) from a server route | Picks and explains suggestions |
| Hosting | Vercel | Auto deploy from GitHub |

**Env vars:** `NEXT_PUBLIC_MAPBOX_TOKEN`, `ANTHROPIC_API_KEY`. Never commit `.env.local`.

## Data model
```ts
type Companionship = { id: string; name: string; start: string; end: string | null; isCurrent: boolean }
type Walk = { id: string; companionshipId: string; date: string; path: [number, number][]; timestamps: number[] }
type Action = { id: string; companionshipId: string; walkId: string; type: 'knock' | 'contact' | 'lesson'; lngLat: [number, number]; time: number; outcome: 'none' | 'interested' | 'lesson_set' }
type Appointment = { id: string; time: string; label: string; lngLat: [number, number] } // today only
type Zone = { id: string; name: string; polygon: [number, number][] } // named sub-areas for suggestions
```

## Synthetic data (generator script)
- Area: Edgemont neighborhood, north Provo, Utah. Residential streets only, pulled from Overpass.
- 6 months ending today. 4 companionships, transfer about every 6 weeks. The last one is "Us."
- Walks follow real street segments with realistic timestamps (mornings and afternoons, about 2 to 4 hours a day).
- Actions placed along walks. Mostly knocks, some contacts, few lessons.
- 3 appointments for today at fixed times.
- 5 to 8 named zones covering the area.
- **Planted patterns** (the AI should find these):
  1. One zone nobody has worked in 3+ months (neglected).
  2. One street with high contact-to-lesson rate last month (repeat what worked).
  3. One untouched zone within a 10 min walk of today's 2pm appointment (nearby).
  4. Coverage drops right after one transfer.
- Snap points so no action sits exactly on a building centroid. Use a fixed random seed so data is reproducible.
- Output: `public/data/*.json`.

## Visual encoding
- UI is monochrome: near black background, dark grey panels, 1px borders, white and grey text, sharp corners (no border radius anywhere).
- Color only lives on the map.
  - **Us:** warm amber, fading toward grey with age.
  - **Previous elders:** muted steel blue, fading toward grey with age.
  - **Selected suggestion:** white outline on the zone, dashed white walking route.
- Buildings: low, flat, dark grey.
- Hex columns (H3 resolution 10): height = action count in the selected time range, color = recency of the most recent action.
- **Fallback if 3D hexes perform badly:** glowing street lines (`PathLayer`), width and brightness by how often each segment was walked.

## Phases

### Phase 1: Map, columns, and UI overlay
- Next.js + TS + Tailwind, Mapbox dark style centered on Edgemont, pitch ~55°, 3D terrain, low flat dark grey buildings.
- Extruded `H3HexagonLayer` using a small mock dataset (a few hundred actions split between Us and Previous elders). Real data comes in Phase 2.
- Markers for door knocks and street contacts, visually distinct.
- UI overlay matching the mockup: header, left panel (segmented control + activity filters, both working), right panel placeholder for Plan my day, bottom timeline placeholder.
- **Done when:** it looks like the mockup, Us vs Previous elders and knocks vs contacts read in one glance, and tilting and rotating stays smooth.

### Phase 2: Data generator
- Script in `scripts/generate.ts` produces all JSON per the spec above.
- `scripts/validate.ts` checks: all points inside area bounds, timestamps ascending per walk, every action belongs to a valid walk and companionship, no gaps in companionship coverage, all 4 planted patterns are present.
- **Done when:** validate passes and walks visibly follow real streets when drawn.

### Phase 3: Trails and time
- `TripsLayer` for walks, colored by companionship.
- Single time state `{ start, end }` drives everything.
- Bottom scrubber with play/pause, transfer markers, highlighted range.
- Chips: Last 7 days, Last 30 days, Since we arrived, All time. Chips set the range on the same state.
- Use deck.gl `DataFilterExtension` to filter by time on the GPU.
- **Done when:** play animates 6 months smoothly (no visible stutter) and every chip updates the map.

### Phase 4: Hex columns
- `H3HexagonLayer` extruded, recomputed when the time range or filters change.
- Hover a hex: tooltip with action counts and last visit date.
- **Done when:** the neglected zone visibly reads as empty or grey and the successful street reads as tall and bright.
- If frame rate drops below ~30fps, switch to the street line fallback.

### Phase 5: Controls
- Left panel: segmented control (Us / Previous elders / Everyone), activity filters (knocks, contacts, lessons).
- **Done when:** every control changes the map and nothing else in the UI uses color.

### Phase 6: Plan my day (AI)
- **Step 1, deterministic:** a scoring function ranks zones on three signals: neglect (days since last action), success (contact-to-lesson rate in the last 60 days), proximity (walking distance to today's appointments). Output the top 6 candidates with their stats.
- **Step 2, Claude:** `POST /api/plan` sends the candidates and today's appointments. Claude picks 3, labels each as NEARBY, REPEAT WHAT WORKED, or NEGLECTED, and writes one sentence citing the actual numbers. Return strict JSON: `[{ zoneId, type, reason }]`.
- Validate the response: zone IDs must exist, reasons must reference real stats. If invalid or the API fails, fall back to the top 3 from step 1 with templated reasons.
- **Click a suggestion:** camera flies to the zone, zone gets a white outline, a dashed walking route draws from the nearest appointment (Mapbox Directions, walking).
- **Done when:** 5 runs in a row return valid suggestions that match the planted patterns, and killing the API key still shows the fallback.

### Phase 7: Polish and deploy
- Empty, loading, and error states. Loading state for Plan my day.
- Opening state: "Since we arrived," camera framed on the whole area.
- Public GitHub repo, README with live link and a GIF, deployed on Vercel with env vars set.
- **Done when:** the full checklist below passes on the live URL.

### Phase 8: Mobile layout (optional)
- Responsive layout under 768px: map full screen, panels become a bottom sheet, scrubber stays pinned at the bottom.
- **Done when:** the demo path works on a phone using the Vercel URL.

### Stretch (only if everything above is done)
- GPX import: drop a GPX file, it appears as a walk in amber and updates the hexes.

## Final test checklist
- [ ] Loads in under 3s on the live URL, in a fresh incognito window
- [ ] Scrubber plays smoothly through all 6 months
- [ ] Every chip, toggle, and filter changes the map
- [ ] Plan my day returns 3 valid, specific suggestions 5 times in a row
- [ ] Clicking each suggestion flies, outlines, and draws a route
- [ ] Fallback works with no API key
- [ ] No console errors on the demo path
- [ ] No API keys visible anywhere in the repo or on screen
- [ ] Demo path rehearsed 3 times without a hiccup: open → play history → switch to Previous elders → Plan my day → click a suggestion

## Out of scope
Accounts, sharing anyone's live location, native mobile app, database, real Area Book data, chat with the AI, turn by turn navigation.

## Platform
Desktop-first web app, responsive down to phone width. One codebase, deployed on Vercel.
