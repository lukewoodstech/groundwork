# Build log

How Groundwork was built, from the git history. Everything below happened on October 22, 2026, between 4:07 pm and about 6:00 pm Mountain time. Two Claude Code sessions worked in parallel from the same spec: one built features on `main`, the other built brand and polish on a `polish` branch in a separate git worktree, then merged.

The spec (`SPEC.md`) set the rules: read it before every task, build one phase at a time, don't add features that aren't in it, run typecheck, lint, and build after every phase, and keep it simple.

## Setup

- `0f4869e` 16:07 · Initial commit from Create Next App.
- `6dca4e8` 16:09 · Next.js, Tailwind, folder structure, the spec, and `.env.example`.

## Phase 1 · Map, columns, and UI overlay

- `9e3e95a` 16:27 · Mapbox dark style centred on Edgemont, deck.gl hex columns and action markers over a small mock dataset, and the monochrome overlay: header, left panel with a working segmented control and activity filters, Plan placeholder, timeline placeholder.
- `074e9c0` 16:32 · A quieter basemap, a range band on the scrubber, the Next dev indicator hidden. Terrain turned off and the reason recorded in the spec: Mapbox GL v3 terrain misplaces deck.gl layers, so the deck.gl stack stayed and terrain went.

## Phase 2 · Data generator

- `f3260e8` 16:53 · The area boundary, the generator running on real OpenStreetMap streets, and the walked-street hierarchy. `scripts/validate.ts` checks bounds, ascending timestamps, references, companionship coverage, and the four planted patterns.
- `ce0f185` 16:54 · Effort columns scaled to the busiest cell.

## Phases 3 to 5 · Trails, time, columns, controls

- `b7567a9` 17:09 · A bigger area, three levels of walked streets, and the period controls (Day, Week, Month, 6 Months) on one time state.
- `fd9d31d` 17:18 · Tighter 45° framing, street widths capped in pixels, 6 Months as the default window.

## Phase 6 · Plan my day

- `12b1c2a` 17:36 · Deterministic zone scoring on neglect, success, and proximity; `POST /api/plan` asks Claude to pick three and explain each with real numbers; strict validation with a local fallback; click a suggestion to fly, outline, and draw a walking route. `scripts/check-plan.ts` runs it five times against the planted patterns.
- `027d686` 17:39 · Replay grows the window from the data start, the README, appointment labels on the map, dashed route lines.
- `b056a23` 17:41 · Dropped an unused argument.
- `f001a02` 17:50 · README gets the live link after the first Vercel deploy.

## Brand and polish (parallel branch)

- `361add2` 17:30 · Three mark options in `brand/` with a comparison page at 16 to 512 px.
- `fe9dbbf` 17:36 · A six-step type scale, a `.ctl` class giving every control hover, active, focus, and disabled states with 150 ms transitions, a load screen with a thin progress line, a 404 page, formatted counts, tightened labels.
- `a9f7f46` 17:49 · Mark C chosen for reading best at 16 px. Header lockup, scheme-aware SVG favicon, `favicon.ico`, apple-touch-icon, web manifest, and an Open Graph image drawn from the real street data with walked streets glowing amber and blue. Tagline: See where you've been. Know where to go.
- `0eff405` 17:49 · Merged `main` into `polish`; conflicts in `Groundwork.tsx` and `MapView.tsx` were both sides adding a prop, kept both.
- `608e81e` 17:51 · The merged Plan panel moved onto the shared classes.
- `e22705b` 17:52 · Merged `polish` into `main`. Vercel deployed it to production from the push.

## Phase 7 · Polish and deploy

- Closing pass: the "00 places" count hidden until a plan exists, the unused `@deck.gl/extensions` dependency removed, README completed with the demo path and a demo GIF, this log written, and the spec's final checklist run against the live URL.

## Decisions worth keeping

- **Terrain off.** Mapbox v3 terrain and deck.gl disagree about where the ground is. The spec's note records it so nobody re-enables it by accident.
- **Static JSON, no fetch.** Data is generated once and bundled, so the demo never depends on a live data source.
- **Claude suggests, the ranking decides what's allowed.** The model only picks from the top candidates and its answer is validated against them; anything else falls back to the deterministic top three.
- **Colour only on the map.** The UI is monochrome with sharp corners. The one place colour appears is the amber and steel blue of the walks.
- **A worktree for parallel work.** The polish session never switched branches in the checkout the feature session was using.
