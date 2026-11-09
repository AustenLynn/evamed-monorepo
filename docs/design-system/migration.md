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
