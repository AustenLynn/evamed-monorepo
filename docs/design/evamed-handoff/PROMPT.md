# First prompt for Claude Code

Unzip `evamed-handoff/` into the monorepo at `docs/design/evamed-handoff/`, open Claude Code at the repo root, and paste:

---

Read `docs/design/evamed-handoff/HANDOFF.md` in full. It's the source of truth for this feature. The `.dc.html` files in `mockups/` are visual reference only, and their sample data is mostly not in our database.

**Start with §0 (Reconciliation protocol). Don't write any feature code yet.**

1. Compare the handoff and the six mockups against the current repo: frontend, backend, fixtures, `calculos/`, routing, existing material forms, and `git log 0580630..HEAD`.
2. Create `docs/design/evamed-handoff/RECONCILIATION.md` using the table format in §0.1.
   - Include every known item K-01…K-17 from §0.4, each confirmed or corrected with evidence (path:line or command output).
   - Add every new inconsistency, error, missing-data item, decision and repo drift you find.
3. Stop and post a summary: counts by type and severity, then every **Blocking** row in full with your recommendation. Wait for my answers.

After I answer, record the decisions in the file and work phase by phase as in §10.

- Stop after each phase with `npm test`, `npm run lint`, the production build and `python manage.py test` passing.
- At each stop, report new findings, the defaults you assumed, and what's still open.
- Keep the app NgModule-based with RxJS and `*ngIf`/`*ngFor`.
- No new dependencies, and no raw hex in component SCSS.
- Never invent data to match a mockup.
- Never change `calculos.ts` or seed data.
- Phase 5 only after I approve it.
