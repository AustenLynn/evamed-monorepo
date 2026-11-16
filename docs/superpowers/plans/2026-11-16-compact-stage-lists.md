# Compact stage lists implementation plan

> **For agentic workers:** Use superpowers:executing-plans. The owner approved compact Materials-style rows, with metadata only when expanded.

**Goal:** Compact list mode for Construction, Usage and End of Life while preserving card mode and independent editors.

**Architecture:** Keep the existing equipment/Usage templates and domain handlers. Extend the shared prefix-parameterized stage presentation mixin with a list-only row layout. Hide database/region metadata in collapsed list rows; retain it in expanded rows and cards. No persistence, API, catalogue-menu or unit changes.

**Tech Stack:** Existing Angular NgModules/Material, Sass tokens and Vitest.

## Approved design

Desktop rows place the readable name, saved quantity/unit and edit/delete controls horizontally. Usage also shows its saved assigned percentage. Use compact support/body typography and approximately56–64px healthy single-line rows, wrapping long names naturally. At390px, name sits above quantity/share/actions, without horizontal overflow. The existing editor expands under its row, with Save/Cancel unchanged. Card geometry, typography and visible metadata stay intact. Only main-stage lists are in scope; catalogue views are separate.

## Tasks

- [x] Add failing presentation regressions for both equipment stages and Usage: list hides collapsed metadata, reveals it for the expanded row, preserves exact-ID actions, saved percentages and drafts through view changes.
- [x] Add list-only shared styles and small markup hooks for accessible compact controls; exclude lists from card subgrid tracks. Keep editing/data logic untouched.
- [x] Run focused/full frontend tests, touched-file lint and production build. Render all three stages at1440/390; assert compact row bounds, no overflow, metadata visibility and card before/after equality. Inspect screenshots, long names, legacy notices and expanded editors.
- [x] Run fresh read-only review, address important findings, document shared list variant and handoff; keep work local for review.

## Completion evidence

480 frontend tests pass; four touched templates/specs lint clean; production build passes with existing warnings only. Real Chromium checks cover Construction/Usage/End of Life at1440/390:56–57px desktop and63–64px mobile healthy rows; metadata expanded only; drafts retained across view changes; keyboard activation; no horizontal overflow/errors. All six card comparisons are pixel-identical. Long names, high-precision decimals and Usage warnings pass; independent reviewer also verified empty/single rows, rounded corners and visible focus.

Fresh read-only review: no Critical/Important/Minor findings. Validation boundaries: backend/API code was unchanged, so no new backend run was needed; native screen-reader output and non-Chromium rendering were not exercised. Review handoff: `docs/handoff/2026-11-16-compact-stage-lists.md`. Local branch only; no push/deployment.
