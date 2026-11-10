# Equipment filters and material-style cards

Owner direction, 2026-11-09: both Construction and End of Life menus should filter by database/region and match Materials cards, with readable names and separate metadata badges.

Implementation: use existing `/explorer/construccion/` metadata for equipment in both stages, preserving source IDs and raw names. Load all catalogue pages before local filtering, cache the source catalogue, and preserve actual unit/process mappings. Missing database/region stays explicitly unknown; do not infer a database from a region or ecoinvent pin. No backend/schema/data changes.

Reuse the real explorer filter panel, source chip and region chip. Keep source-only add, direct replacement, selection across filters and saving locks. The main cards show the readable name and metadata separately; raw names remain available through title text and search. No impact badges or values without reference units.

Plan (inline execution):

1. Write regressions for metadata/pagination and filters across both stages, selection retention, unknown metadata, pending locks, and main-card display; observe red.
2. Load authoritative existing metadata, expose readable name/database/region, and reuse explorer filters/chips with matching responsive layout.
3. Run targeted and full frontend tests, touched-file lint, production build, desktop/mobile browser checks. Update design-system migration notes. No commit/push until requested.

## Verification

Implemented and verified on `feat/equipment-catalogue-filters`. Frontend: 437 tests across 58 files pass, including metadata pagination/caching, both stages’ filters, hidden selection retention, explicit unknown values, readable main-card names, and pending-search save/re-enable regressions. Touched-file ESLint and production build pass; existing home/material-stage style-budget warnings and file-saver CommonJS warning remain. Diff whitespace check passes.

Built-app browser checks use intercepted API fixtures only: filter interactions at 1440/900/390, all four stage routes at 390, readable main names, actual Material dialog title styling, no horizontal document overflow, and a batch create with quantity 0/unit null. No live project data was written. Independent review found one pending-search edge case, fixed with red→green regressions; no other important findings.
