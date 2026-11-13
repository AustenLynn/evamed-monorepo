# Usage stage continuation

The owner approved the Usage visual concept on 2026-11-13 and asked to continue. They then requested a remote push to resume in another environment.

- Application baseline: `324078c`, equipment card alignment. Existing application changes were already on remote main.
- Approved visual flow and mockup links: [Usage concept](../design-system/usage-concept.md).
- Proposed technical design: [Usage implementation design](../superpowers/specs/2026-11-13-usage-stage-design.md). Technical recommendations are not separately approved. Builder review and implementation plan remain pending; no Usage application code has been changed.
- Supporting design context, project/draft IDs and asset links are preserved under `.superdesign/`. Maintained design-system documentation remains authoritative.

Next: review the proposed technical design, settle idempotent saves and catalogue classification in the implementation plan, then implement the shared Usage editor with atomic persistence. Preserve all saved source row IDs and do not reinterpret Unit/EnergyUnit IDs. See the design for legacy repair, percentage and calculation requirements.

The previous machine ran out of disk space. The draft originally saved in `/tmp` is now copied into this repository. Local Playwright ffmpeg and headless Chromium caches were moved into `/tmp/evamed-handoff-*` to make room for this handoff; these paths are not required in the next environment. No application tests were run for this documentation-only handoff.
