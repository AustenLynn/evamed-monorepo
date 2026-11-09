# Frontend design consistency

For UI work, read `../../docs/design-system/README.md` and the relevant foundations/component guidance first. Explorar Material, Ficha and Edit Material are the approved references.

Reuse `src/app/shared/ui`, `src/styles/_tokens.scss` and the opt-in roles in `_ui.scss`. Keep feature data and validation outside generic UI. Document justified new variants and migration status under `docs/design-system/` and update the development reference when shared primitives change.

Preserve keyboard access, disabled/pending states, real labels and the single main scroll owner in menus/forms. Check affected UI at desktop and 390px. Do not sweep deferred legacy pages into an unrelated feature change.
