# Usage stage — existing EVAMED patterns

Status: approved by the owner, 2026-11-15. The owner explicitly requested planning and unattended implementation. Deployment remains subject to later review.

## Intent and authority

Make Usage feel like the established Construction and End of Life stages. The previous implementation was reverted because it departed from their design system. Reuse their actual composition and components, rather than creating a new page that merely shares colours.

Authority, in order: owner feedback in this conversation; maintained `docs/design-system/`; the actual Construction stage and equipment cards; the current reviewed preview. The older Usage implementation and draft are not visual references for this work.

- Current [preview](https://p.superdesign.dev/draft/9ef6dbde-8815-4fde-bea4-4a8a7b6b3408), version 2, and [canvas](https://superdesign.dev/teams/f83286a9-4785-46e1-932a-d0e94f28ca55/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e?node=draft-variant-9ef6dbde-8815-4fde-bea4-4a8a7b6b3408).
- The side-by-side preview uses captured Construction HTML/styles and synthetic data. It is a visual prototype, not a final persistence specification.
- Owner decisions: maintain the existing design system; use the reviewed layout; remove the separate Fotovoltaicos button and include photovoltaics inside Agregar fuente; save annual consumption and individual cards independently, as Construction does.

## Approaches considered

1. **Independent Save/Cancel — selected.** The annual form saves its own change; each source card saves its own change. This matches the existing equipment-card interaction and limits what each action commits. Updating the annual total must still update its dependent quantities atomically.
2. **One Save for the whole page — not selected.** This would commit annual consumption and several source drafts together, but introduces a different interaction from the established cards and makes pending changes harder to attribute.

Keep Angular NgModules, RxJS, Angular Material and the existing Django/DRF stack. No dependency or framework migration is part of this design.

## Visual contract

Preserve the existing header, project heading/back link, white stage shell, connected stage navigation with its current assets, energy bar and footer. Keep the existing lower Atrás/Continuar/Ir a resultados placement and appearance. Do not introduce a new navigation strip, dashboard header, KPI cards, fonts or colour theme.

At desktop, retain Construction's existing column composition: annual consumption takes the place of the building-element column; source cards occupy the main panel. Usage applies to the whole building, so it has no element image, Cimentación selection or building-element-specific copy. At 390px, the annual column stacks above the source panel using the existing stage responsive pattern.

Use the actual equipment-card title/quantity/edit/metadata/delete structure, grid/list switch and independent expanded-card heights. The reviewed reference measurements are a 12px card radius, 20px 16px 12px summary padding, 16px/700 title, 26px quantity and 13px unit label. These are checks against the current components, not permission to hardcode a second style system. Quantities use the shared `quantityDisplay` formatting.

The source panel has one primary **Agregar fuente** action. Its bottom sheet reuses MenuShell, FilterPanel, source/region chips and SelectionTray, including the existing height, focus handling, single main scroll owner and persistent tray. Photovoltaics are an option inside this same menu; there is no separate page button. Actual renewable-product details, impact badges or factors must not be invented.

Source cards display the readable name, calculated annual quantity, assigned share with Editar fuente, supported database/region metadata and Eliminar. Photovoltaic cards show their generation label and quantity/share without invented catalogue, database, region or impact metadata.

Annual and source forms use the existing outlined Material fields and Save/Cancel actions. Errors and legacy notices use maintained semantic roles and stay local to the affected form/card. Normal cards must not become a developer diagnostics screen. Reuse or extract shared visual styles where appropriate; Usage-specific data and validation stay outside generic UI and equipment persistence.

## Annual consumption and source interactions

Both `/usage-stage` and `/usage-stage/update` use the same editor and saving behaviour. No annual record means an empty annual form; sources can be added once a valid annual consumption is saved. Zero is valid.

Each source has a draft with a percentage and selected catalogue type. Its quantity is read-only and derived from the saved annual total. Replacement selects one source directly, preserves the row ID/share and updates only that card's draft; Save changes persists it and Cancel restores the saved source. Cancelling the catalogue preserves values already entered in the card.

Adding sources uses the multi-selection tray; selections survive searching/filtering and do not write until Agregar N fuentes. New sources start at 0%. New duplicate selections are excluded, while every already-saved row remains visible, including repeated types or families. Photovoltaics retain the existing `source=panels,type=null` representation. Do not collapse historical rows to one row per family.

Cancel affects only its own annual/card draft. Switching cards preserves unsaved drafts, with one expanded editor at a time, matching the existing equipment pattern. Explicit deletion requires confirmation and removes only the selected persisted row; failure leaves the row and draft intact.

**Proposed calculation rule for independent drafts:** only saved values feed persistence, calculated quantities and the energy bar. A source Save uses the last saved annual total, not text in an unsaved annual form. Annual Save uses the saved source percentages, not drafts in other cards. Other drafts survive either save and their previews refresh against the newly confirmed saved total. If necessary, helper text identifies that a preview uses the saved annual total.

Saving annual consumption keeps shares fixed and recalculates all dependent quantities in one transaction. Example: 10000 with 60% and 20% becomes 12000 with 7200 and 2400; 20% remains unassigned. Allocation below 100% is allowed with an existing-style warning; allocation above 100% is rejected without partial changes. A narrowly scoped legacy-repair exception permits source-only saves/removals that strictly reduce an already over-allocated saved total; annual changes and additions remain blocked while the resulting allocation exceeds 100%. This allows independent repairs without deleting historical IDs. Retain current nonnegative whole annual totals and whole shares from 0 to 100; preserve Decimal source quantity precision and return decimal strings. Fractional shares or annual totals require a separate contract decision.

Saving disables duplicate submissions and affected mutation/navigation controls until the outcome is known. Failed saves preserve their drafts. Navigation away from dirty drafts offers explicit discard confirmation; cancelling navigation keeps them. Switching editors is not a navigation-away action and does not silently discard another draft. The energy bar changes only after confirmed persistence or confirmed saved-state loading.

## Safe persistence and legacy records

Use authenticated project ownership and atomic saves, with stable record IDs, stale-state detection and persisted operation identity. Saving an individual card must not overwrite unrelated annual data or source drafts. Annual total changes are a single coherent operation with their dependent quantities. Validate the full request before writing; reject foreign/conflicting IDs and concurrent stale revisions without partial writes.

After an uncertain response, reload/reconcile the submitted operation before retrying additions. Freeze that submitted catalogue selection while its result is unresolved so reconciliation cannot discard newer unsaved intent. Confirmed failures keep the selection; confirmed success resolves only the corresponding draft. Existing legacy CRUD endpoints remain compatible; do not claim that every legacy writer participates in the new serialization mechanism.

Annual/source references currently point to Unit, not EnergyUnit. The owner approved creation of live `Unit 22=kWh`, verified on 2026-11-14; `EnergyUnit 1=kWh` is separate. Resolve the unique canonical kWh by its actual Unit label at runtime, never by hardcoded ID or by copying an EnergyUnit ID. Missing/ambiguous canonical units produce a focused actionable error. This feature must not insert units automatically or convert existing data silently.

Keep every saved ID, unit, quantity, percentage and family intact until an explicit save/repair/removal. Missing catalogue types and inconsistent units/shares/quantities remain visible. Provide explicit repair with old/new unit labels where relevant; correcting a label/reference is not an energy conversion. Repairing one row leaves unrelated rows untouched. Ordinary annual changes are blocked until affected inconsistencies are resolved. A negative legacy annual must have a coordinated, explicitly confirmed repair path that retains source IDs; it must not require deleting all sources to recover. Multiple annual rows produce a repair-needed state without choosing one implicitly.

Use verified catalogue metadata or an explicit reviewed mapping for supported electricity/fuel families; unknown names are not automatically electricity. Unsupported saved types remain visible; unsupported new selections are blocked. Preserve B6 formula/factor selection and the existing treatment of photovoltaic rows.

The reverted deployment previously applied migration `0085_usagesavereceipt`; reverting source does not remove its live table or migration record. Before planning schema work, inspect that retained state. Any reuse of receipt persistence must accommodate both a fresh database and this existing deployment without creating the table twice or deleting historical data. Reusing reviewed backend logic is permitted only after checking it against this design; the reverted frontend is not the layout source.

## Verification and delivery boundaries

Before integrating saving logic, render the Usage shell/cards beside the actual Construction reference at 1440px and 390px. Check typography, padding, card alignment, small unit labels, connected navigation, inline editors, catalogue/tray and footer. Also inspect loading/empty/error/legacy states, long names, keyboard access, focus restoration, disabled/pending controls and document overflow. The owner should review the implementation's visual match before it is deployed.

Persistence checks must cover both routes, repeated source rows, zero/incomplete/over-allocation, fixed shares, Decimal recalculation, independent drafts/saves/cancellation, replacement identity, exact deletion, ownership, stale/uncertain responses, retries without duplicate additions, local legacy repair, negative annual recovery and unchanged B6 treatment. Test fresh schema creation and the retained 0085 deployment state.

Run relevant backend/frontend suites, touched-file lint, production build and whitespace checks. Update maintained design-system documentation for any justified new shared visual role. Keep visual acceptance distinct from backend correctness; passing tests does not establish design-system consistency.

The owner subsequently approved this design and authorized writing the plan and implementing it unattended on 2026-11-15. This authorization covers local application commits; it does not cover live-record changes, push, merge or deployment. The implementation must remain reviewable on its feature branch.

## Calls proposed for the builder

- Independent drafts use confirmed saved counterparts for calculations and preserve other drafts, as described above.
- Component decomposition, exact API/serializer layout, receipt persistence and source classification mapping are builder choices, subject to stable IDs, atomicity, legacy safety and existing schema state.
- Share presentation primitives/styles without turning the equipment component into a universal domain editor or changing Construction/End of Life behaviour.
- The current preview's quantity-led card hierarchy is the visual reference; the percentage is edited inside the source card. Do not restore the earlier percentage-led dashboard layout.
