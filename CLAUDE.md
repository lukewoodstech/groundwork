# Groundwork

## Rules
- Read `SPEC.md` before every task. It is the source of truth for scope, stack, data model, and phases.
- Build one phase at a time. Stop after each phase for review. Do not start the next phase until asked.
- Do not add features that are not in the spec.
- Before calling a phase done, run `npm run typecheck`, `npm run lint`, and `npm run build`, and fix anything that fails.
- Keep it simple. When there are two ways to do something, pick the one with less code.
- Never commit `.env.local`. Env var names live in `.env.example`.

## Layout
- `app/` routes and layout
- `components/map/` Mapbox + deck.gl
- `components/panels/` header, left and right panels
- `components/timeline/` bottom scrubber
- `lib/data/` types, loaders, mock data
- `lib/scoring/` zone scoring (Phase 6)
- `lib/colors/` color ramps for the map
- `scripts/` data generator and validator (Phase 2)
- `public/data/` generated JSON

## Design
- UI is monochrome. Color appears only on the map.
- No border radius anywhere. 1px borders, dark grey panels, white and grey text.
- The mockup is a wireframe for layout only. Do not copy it literally.
