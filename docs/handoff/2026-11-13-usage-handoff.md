# Usage stage continuation

## Current state — 2026-11-15

The previous implementation (`7a9062d`) was reverted and the rollback (`9e9b331`) deployed after the owner reported that the implementation ignored the established design system. Application source is back at the pre-refactor baseline. Project records were preserved. The separately approved live `Unit 22=kWh` remains, and the deployed database is expected to retain migration 0085 and its unused receipt table; verify those before any schema work.

Planning has restarted from the actual Construction layout and equipment components. The current [visual preview](https://p.superdesign.dev/draft/9ef6dbde-8815-4fde-bea4-4a8a7b6b3408), version 2, uses the existing stage shell/navigation and card hierarchy. The owner removed the separate Fotovoltaicos button (photovoltaics now appear inside Agregar fuente) and selected independent annual/card Save/Cancel.

Read the [current design proposed for approval](../superpowers/specs/2026-11-15-usage-stage-design.md), not the older implementation design as an execution brief. Its builder check found no important unanswered questions. The next step is owner review of that design, followed by an implementation plan. No application implementation, commit/push or deployment is authorized by this planning restart.

Only design metadata/documents and ignored visual prototypes have changed locally. The earlier checkpoint below is historical and does not override these current decisions.

## Earlier checkpoint

The owner approved the Usage visual concept on 2026-11-13 and asked to continue. They then requested a remote push to resume in another environment.

- Application baseline: `324078c`, equipment card alignment. Existing application changes were already on remote main.
- Approved visual flow and mockup links: [Usage concept](../design-system/usage-concept.md).
- Proposed technical design: [Usage implementation design](../superpowers/specs/2026-11-13-usage-stage-design.md). Technical recommendations are not separately approved. Builder review and implementation plan remain pending; no Usage application code has been changed.
- Supporting design context, project/draft IDs and asset links are preserved under `.superdesign/`. Maintained design-system documentation remains authoritative.

Next: review the proposed technical design, settle idempotent saves and catalogue classification in the implementation plan, then implement the shared Usage editor with atomic persistence. Preserve all saved source row IDs and do not reinterpret Unit/EnergyUnit IDs. See the design for legacy repair, percentage and calculation requirements.

The previous machine ran out of disk space. The draft originally saved in `/tmp` is now copied into this repository. Local Playwright ffmpeg and headless Chromium caches were moved into `/tmp/evamed-handoff-*` to make room for this handoff; these paths are not required in the next environment. No application tests were run for this documentation-only handoff.
