# Migration inventory

Initial migration: implemented and locally verified, 2026-11-09.

| Area | Status | Shared patterns |
| --- | --- | --- |
| Explorar Material picker | Migrated | Menu shell/header, tray/removal, primary action; preserved scroll restoration |
| Explorer result cards/filter/results | Migrated foundations | Surface and heading roles; existing domain filters/tables retained |
| Ficha | Migrated foundations | Panels, headings and primary/tertiary actions; facts/tables/badges remain domain patterns |
| Edit Material | Migrated foundations | Form density, field groups, summary surface, actions and notices |
| Stage material edit header | Migrated heading | Existing single scroll owner retained |
| Equipment picker | Migrated | Same menu shell/header, tray/chips, actions, card surfaces and heading weight/line height |
| Construction/End of Life equipment panel | Migrated | Surfaces, headings, form density, actions; all four hosts consume shared panel |
| Header/footer/stage navigation | Deferred | Preserve existing layout and behaviour |
| Usage, project/admin/auth/results pages | Deferred | Scope a separate migration before changing |
| Legacy global Material overrides | Deferred | Audit consumers before retirement; no blanket reset |

Intentional differences: Ficha 24px titles, menu 20px titles, compact inline form summary; equipment has no material impact data or mandatory unit at add time. Equipment editor remains inside selected card. Selection tray visibility follows each feature's existing add/replacement behaviour.

## Verification record

- Frontend suite: 58 test files / 425 tests passed. New tests cover shared projection, exact-ID removal, disabled controls and development/production route separation. Existing material and equipment regressions remain green.
- Touched TypeScript/templates: ESLint passed. Production build passed; existing home/material-stage style-budget warnings and file-saver CommonJS warning remain. Diff whitespace check passed.
- Synthetic reference checked at 1440, 1100, 900, 600 and 390px: no horizontal document overflow, no project API requests or browser exceptions. Material edit has only the shell body scrollbar when content needs scrolling. Menu, Ficha and edit screenshots inspected at desktop/mobile.
- Built production app with intercepted API fixtures: all four equipment routes rendered at 390px; construction/update also checked at 1440px. Inline editor and batch add preserved quantity 0/null unit. No browser exceptions. No live project data was written.
- Real dialog title regression reproduced before correction: Material produced black/500. Shared supported title tokens now yield green/20px/700; the explicit browser assertion passes.
- Material catalogue and Ficha layouts compared with pre-migration screenshots at 1440/390. Existing cards, typography, surfaces and responsive behaviour retained.
- Production JavaScript contains no reference-page content. Production and docker configurations both replace the development routes with an empty list. Docker uses that same configured exclusion; a separate docker build was not run.
- Independent review found no critical/important issues. Minor documentation/API mismatch corrected. One resource-constrained combined check was interrupted; verification was repeated sequentially with normal timeouts.

These checks exercise local fixtures and shared UI; they are not a live-backend or production deployment audit.

## Equipment catalogue follow-up — 2026-11-09

Database, type and region filtering now reuse the explorer filter panel in both equipment menus. Main cards and catalogue entries show readable titles with the same source/region chips as Materials. Unknown metadata stays explicit. The existing construction explorer API supplies metadata for both construction and C1 deconstruction; this does not introduce disposal scenarios or equipment reference-unit assumptions. See equipment-filters.md for the scoped implementation and verification.

## Equipment card alignment — 2026-11-10

Collapsed cards now share title, quantity, edit, metadata and delete rows. Metadata and Delete remain on separate lines; long names wrap without clipping. Expanded editors retain independent card heights. Browser regression reproduced unequal card heights (219–282px) before the fix and confirms equal per-row heights and matching content positions at 1440/1100px, natural single-column cards at 390px, and no stretching of adjacent cards during editing. Production build and 17 equipment-panel tests pass. Existing build warnings remain unchanged.

A legacy stage-navigation label still extends past the viewport at 1100px; inspection isolated it to `.mdl-stepper-tag`, outside the equipment cards. Navigation migration remains deferred. Card bounds fit at all checked widths; document bounds pass at 1440/390px.


## Usage source cards — 2026-11-13

Both new and reopened-project Usage routes now use the same whole-building editor. Annual consumption and source shares have explicit Save/Cancel actions, stable row identity, inline source cards, a separate photovoltaic action and catalogue-based source replacement. Source percentages stay fixed when the annual total changes.

The catalogue reuses MenuShell, SelectionTray, FilterPanel, database/region chips and the existing 75%-height sheet. It has one main scroll area and retains selection across filters and failed saves. No source impact badge or reference factor is invented. The existing EVAMED header, stage identity assets, energy bar and footer remain in use.

Legacy unit/family/percentage/quantity inconsistencies remain visible. A Unit reference is never read as an EnergyUnit reference. Repair requires an explicit old/new unit confirmation; absent or ambiguous canonical kWh units block creation. Multiple annual rows block writes. A project-scoped atomic save uses optimistic revisions and durable request receipts, with reload/review after conflicts or uncertain responses. Historical records and B6 formulas are unchanged.

Deployment prerequisites: apply migration 0085 (request-receipt table), verify the live Unit catalogue has one intended kWh entry, and review legacy inconsistencies explicitly. This implementation does not insert a Unit or migrate saved values.

Negative legacy annual totals support a coordinated, explicitly confirmed repair that retains source IDs. Metadata can be repaired first without changing raw quantities. A lost-response catalogue save freezes its submitted selection until the user closes the sheet and reloads/reviews the outcome. Initial load failures retain a working return-to-projects action.

Verification: 230 backend tests, 455 frontend tests, production build, touched-file lint, migration consistency and whitespace checks pass. Rendered checks at 1440px/390px cover both routes and loading/empty/error/legacy states without horizontal overflow or browser exceptions. The empty EnergyBar track now includes its border in the declared width, fixing a reproduced 2px mobile overflow.
