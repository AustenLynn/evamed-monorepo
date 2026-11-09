# Shared components and gradual migration

Status: approved by owner 2026-11-09; first migration implemented locally. See migration.md for verification and deferred scope.

## Intent and owner decisions

EVAMED must look and behave consistently across its components. The owner selected Explorar Material as the foundation and explicitly included Ficha and Edit Material. The owner chose shared components with gradual migration and requested a durable folder for all design-system guidance.

The goal is to make the chosen design repeatable in code, rather than rely on each feature copying similar styles. Construction and End of Life are the first migration targets. This is not a new visual brand or an application-wide replacement in one release.

## Approaches considered

1. Shared styles/components, a component reference, and incremental migration. More initial extraction work, but components share implementation and future changes propagate. Selected by the owner.
2. Documentation and independent per-page styling. Faster initially, but leaves duplicate implementations and recurring drift. Not selected.

## Scope and constraints

Preserve application behaviour, labels, catalogue availability, calculations, persistence, and navigation. Keep the approved inline equipment editor and source-only batch selection; do not introduce material-specific fields or technical fichas into equipment selection. Keep Angular Material as the control library, with no new UI dependency or framework.

Do not automatically normalize every legacy page, move business logic into generic UI, change project data, or add new branding. Extraction must preserve the material reference screens before migrating their equipment equivalents.

## Foundations extracted from actual source

Source authority:

- `frontend/evamed/src/styles/_explorer.scss`: current palette and sheet behaviour.
- `src/app/explorer/components/explorer-picker`: menu header, scroll area and selection tray.
- `src/app/explorer/components/result-card`, `filter-panel`, `explorer-browser`, `results-table`: card/filter/result patterns.
- `src/app/explorer/components/material-detail`: Ficha panels, facts and tables.
- `src/app/explorer/components/material-edit` and `material-panel-edit`: form sections, summaries and compact inline presentation.

Relative `src/` paths above are under `frontend/evamed/`.

### Colour and type

Retain the existing `--ev-*` palette: background #f8f8f8, white surface, muted surface #efefef, border #cbcbcb, divider #ededed, black text, caption grey #767676 on white and #595959 on page background. Green fill #a8d024, green #7fa20b, readable green text #5b7408. Keep existing semantic low/mid/high foreground/background pairs; impact meaning must not be repurposed as arbitrary decoration.

Use the current application font stack, Helvetica Neue, Helvetica, Arial, sans-serif, with consistent Angular Material typography inheritance. Do not introduce IBM Plex merely because an old mockup mentions it. Rendered inspection confirmed reference headings use the existing Roboto Material typography; preserve it through a heading token while retaining the body stack.

Define roles rather than one heading size: menu title 20px/700/readable green, Ficha title 24px/700, section/card heading 16px/700, supporting copy 13px, field/search text 14px, compact unit/caption 12px. Prominent catalogue impact value 30px/700; compact form summaries retain their 24px and inline 20px variants. Preserve tabular numerals for quantities. Use the existing card heading line height of 1.3; document any distinct body/control line heights after rendered inspection.

### Spacing and surfaces

Document a bounded spacing scale based on existing values: 4, 6, 8, 12, 16, 20, 24 and 32px. Name tokens by usage or size; do not force all gaps to one value. Standard card radius 12px and border 1px. Cards use 16px padding; Ficha panels may use 20px. Menu bars/trays use 12px vertical and 24px horizontal padding, reduced to 16px horizontal on mobile. Retain input/search radius 10px, alert radius 8px and pill chips as explicit variants.

Reuse existing 600px and 900px responsive boundaries, with 1100px reserved for the current complex form layout. Long source names wrap; flex/grid children can shrink; numeric tables scroll within their own container rather than widening the page.

## Shared implementation proposal

Create a small `src/app/shared/ui/` library within the existing Angular application. Expose components/directives through one module compatible with existing NgModule consumers. The builder may choose exact names and whether a simple visual role is best expressed as a directive, class, or component; avoid components that only add unnecessary wrappers.

- Foundations: move palette definitions into a neutral global token file imported once. Add typography, spacing, radius and form-density roles. Existing explorer consumers continue to resolve the same token values. Keep explorer layout rules separate from foundations.
- Action styles/directives: primary filled action through Angular Material's supported tokens, secondary outlined action, tertiary text action and destructive action. Preserve native button semantics, disabled/pending behaviour and accessible icon labels. Never wrap buttons inside buttons.
- Surface/card primitive: shared border, radius, padding and heading styles with projected content. Catalogue cards and editable equipment cards remain distinct semantic compositions; selection, expansion and actions remain explicit.
- Menu shell: shared heading/context/close area, one main scrolling body, and optional persistent selection tray. It must support direct single-choice replacement without showing multi-add controls. Caller owns dialog opening, focus trap, close restrictions and save lifecycle; the shell must not silently change them.
- Selection tray/chips: shared selected count, names, accessible remove buttons and action slot. Retain material-style pale green chips and bounded overflow for long selections. A bounded chip-list scroll is allowed when necessary; do not add nested scrolling to edit forms.
- Form conventions: shared outlined field density (44px existing compact form variant), field groups, legends, helper/error/warning treatment, action row and summary surface. Use real labels, fieldsets/legends where appropriate, and Angular Material validation. Domain fields and validation stay in their feature.
- Status presentation: common loading, empty, retryable error and partial-failure styles. Screen-reader status and alerts retain their meanings. Failed saves preserve editable inputs.

Reuse existing semantic explorer components where they are already suitable. Avoid turning the material detail, filters, or equipment editor into a large configuration-driven universal component. Tables, source/region/impact badges and tabs are documented as reference patterns; extract or adapt them only when needed for the selected migration.

## Reference page and durable documentation

Provide a development-only component reference using real shared primitives and synthetic examples. It must not appear in production navigation or require live catalogue/project data. Cover buttons, card variants, fields, form sections, menu shell/tray, chips and loading/empty/error states. Include long labels, blank values, disabled/pending controls, keyboard focus and narrow layouts. The builder selects a development-only route or equivalent existing preview mechanism; confirm it is excluded from production builds.

Maintain these documents under `docs/design-system/`:

- `README.md`: entry point, authority and contribution rules.
- `foundations.md`: token names, values, type roles, spacing and responsive rules.
- `components.md`: component APIs, examples, permitted variants, accessibility and interaction rules.
- `migration.md`: each screen/pattern marked existing, migrated, or deferred, plus known exceptions.
- `decisions.md`: dated decisions and rationale; changes to the standard must be recorded here.

Keep the reference tied to production primitives, so documentation cannot silently demonstrate a different implementation. Add a pointer from the existing handoff docs. Agent-facing guidance should point future frontend work to this folder without rewriting unrelated repository instructions.

## Migration order

1. Capture the actual rendered reference screens and audit inherited Material/global styles. Establish tokens and primitives without changing their appearance.
2. Adopt those primitives in Explorar Material, Ficha and Edit Material. Verify preservation of selection, replacement, form validation and scrolling.
3. Migrate shared equipment picker/panel in Construction and End of Life, both new and reopened-project routes. Align titles, weights, line heights, tray/chip styling and action tokens with the material references. Retain inline editing, quantity 0/null-unit batch adds and existing save/cancel/delete semantics.
4. Record other pages and legacy global overrides as deferred work. Future migrations are scoped separately; do not sweep unrelated pages into this release.

## Verification and acceptance

Capture baseline and after screenshots at 1440px and 390px for the reference menu, Ficha, Edit Material, equipment picker and expanded equipment card. Compare typography, spacing, controls and surfaces; review keyboard interaction, contrast, disabled states, long names and page bounds. Test intermediate responsive boundaries where the migrated layouts change.

Use meaningful component/interaction tests for shared shell slots, selection removal and close behaviour, focus, errors and form integration. Preserve existing material and equipment regression tests, including stable IDs, pending locks, decimals, explicit project context and null units. Do not add tests merely restating CSS values. Run full frontend tests, touched-file lint, production build and diff checks. Confirm the reference route/examples are excluded from production.

Success means both feature families consume the same shared foundations and relevant primitives, rather than maintaining visually similar copies; the material references remain visually intact, equipment adopts their conventions, and future contributors can find the rules and examples in one folder.

## Implementation discretion and review boundary

Exact primitive APIs, Sass organization and development reference wiring are builder decisions subject to the constraints above. No application code changes before owner approval of this document. After approval, prepare the implementation plan and execute the migration with reviewable changes. Commit/push only when requested by the owner.
