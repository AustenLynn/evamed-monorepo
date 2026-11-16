# Compact stage lists — 2026-11-16

Owner request: make Construction, Usage and End of Life lists compact like the Materials stage. Owner approved database/region badges only when expanded.

Implemented on local branch `feat/compact-stage-lists`, worktree `/tmp/evamed-compact-lists`, base `2e87e53`. No merge, push, deployment, API or database changes are included in this task.

## Result

The shared stage presentation mixin now has a compact list variant. Desktop rows place name, saved quantity/unit and edit/delete controls horizontally; Usage also retains saved allocation. Healthy rows measure56–57px on desktop and63–64px at390px, compared with roughly220px before. Long names and high-precision quantities wrap naturally instead of clipping.

Each row retains the same expandable editor and Save/Cancel handlers. Database/region badges appear only in the expanded list row. Switching views retains drafts; keyboard Enter expands rows, and screen-reader labels announce saved quantity, unit and Usage percentage. Existing cards remain pixel-identical at1440/390 for allthree stages. Catalogue menus, Materials and backend behavior are unchanged.

## Verification

- Full frontend suite:480/480 tests,64 files.
- New regressions observed failing against original templates, then passing: both equipment stages and Usage collapsed/expanded metadata, exact-ID actions, view-toggle draft preservation and accessible values.
- Touched TypeScript/templates lint:4 files, clean. Production build and whitespace checks pass. Existing home/material-stage CSS-budget and file-saver CommonJS warnings remain; no new style-budget warning.
- Actual rendered checks use synthetic intercepted API fixtures; no live records are read or written. Allthree stages checked at1440/390 for compact height, metadata visibility, independent expanded-row heights, retained drafts, keyboard interaction, long names, high-precision quantities and local legacy warnings. No horizontal document overflow or JavaScript exceptions.
- Six original/current card screenshots compared pixel for pixel: identical.

Local review evidence is under `.superdesign/tmp/compact-lists/` in the worktree. `browser/` contains normal list/editor and before/after card screenshots; `edge-browser/` contains long-name/quantity/warning states. `browser/results.json`, `full-tests.log`, `build.log` and `lint.log` record checks. `browser-check.py` and `edge-browser.py` contain the fixture browser harness.

Suggested screenshots:

- `browser/construction-list-1440.png`
- `browser/usage-list-1440.png`
- `browser/end-life-list-1440.png`
- `browser/construction-list-390.png`
- `browser/usage-expanded-390.png`

Review/integration remains separate. A frontend development server runs at localhost4313, but screenshots use synthetic browser fixtures; the server alone is not a connected local-backend preview.

## Independent review

Fresh read-only review found no Critical, Important or Minor issues. The reviewer independently reran allthree stages at1440/390 and checked empty/single rows,12px corners, hidden empty containers, visible keyboard focus and accessible saved-value names.

Review scope decisions: backend/API code is unchanged, so it was outside this frontend review; unrelated backend regressions are not rechecked here. Chromium layout and accessible names were verified, but native screen-reader output and non-Chromium rendering were not exercised; differences in those environments remain unverified.
