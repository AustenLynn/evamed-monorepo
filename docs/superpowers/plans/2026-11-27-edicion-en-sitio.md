# Edición en el lugar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Construcción, Fin de vida and Uso edit equipment/sources, quantities, percentages and the annual consumption in place, with no expanding form.

**Architecture:** One shared in-place cell (`app-quantity-cell`, moved to `SharedModule`) used by Materiales, the equipment panel and the use stage; each change saves at once through the existing APIs/state (`EquipmentRowsService.update`, `UsageEditorComponent.intent`).

**Tech Stack:** Angular 22 + Vitest (`cd frontend/evamed && npx -y -p node@22 node node_modules/@angular/cli/bin/ng.js test --watch=false [--include=…]`).

**Spec:** `docs/superpowers/specs/2026-11-27-edicion-en-sitio-design.md`

## Global Constraints

- No `<form>`, «Guardar cambios», «Cancelar» or expand/collapse editor remains in the equipment panel or the use source panel / annual consumption.
- Enter or blur saves; Esc restores; an invalid value keeps the cell open, `aria-invalid="true"`, with the error text visible.
- End-of-life equipment quantities are whole numbers; use percentages are whole 0–100; annual consumption is a whole number ≥ 0.
- No backend change.

## Review Focus

1. Blur after Esc must not save (Task 1 `test_escape_then_blur_does_not_save`).
2. A failed save shows the server error on that card and the shown value stays the saved one (Task 2, Task 3 tests).
3. Changing the source/equipment while another save is pending is disabled (Task 2, Task 3 `busy` tests).
4. Leaving the use stage after a failed in-place save does not prompt about unsaved drafts (Task 3 `test_failed_save_leaves_no_draft`).
5. A row saved in a non-hours unit (equipment) keeps its warning icon until saved (Task 2).

---

### Task 1: Shared in-place cell

**Files:** move `materials-stage/components/quantity-cell/*` to `shared/components/quantity-cell/`; declare/export in `shared/shared.module.ts`; drop it from `materials-stage.module.ts`.

**Produces:** `<app-quantity-cell [value] [unit] [display] [integer] [max] [disabled] [label] (changed)="…">`; `changed` emits a number.

- [ ] Tests (`quantity-cell.component.spec.ts`): integer rejects `2.5` and stays open with `Escribe un número entero igual o mayor a cero.`; `max=100` rejects `101` with `Escribe un número entre 0 y 100.`; negative / text rejected with `Escribe un número igual o mayor a cero.`; valid emits and closes; `display` is shown when given; `test_escape_then_blur_does_not_save`; `disabled` doesn't open.
- [ ] Run → FAIL; implement; run → PASS; Materiales specs still pass; commit `feat(shared): in-place quantity cell with whole numbers, max and visible errors`.

### Task 2: Equipment cards in place (Construcción, Fin de vida)

**Files:** `equipment-stage/equipment-stage-panel.component.{ts,html,scss,spec.ts}`, `equipment-stage-ui.module.ts` (import `SharedModule`).

- [ ] Tests (rewrite the editor tests of the spec): the card has no `form`, «Guardar cambios» or «Cancelar»; editing the quantity cell to `17` calls `api.update(stage, row, {sourceId, quantity: 17, unitId})` once; end-life rejects `2.5` without calling the API; clicking the name opens `picker.choose({mode: 'replace'})` and saves the chosen source; a failed update shows `No se pudo guardar el equipo. Intenta de nuevo.` on that card and keeps the saved quantity; name and quantity are disabled while a save is pending; the m³/t·km unit tests still hold.
- [ ] Run → FAIL; implement (remove `expanded`, `drafts`, `edit/cancel/save` form path; add `setQuantity(row, value)` and keep `replace(row)` saving at once); run → PASS; commit `feat(equipos): edit equipment and quantities in place`.

### Task 3: Use sources in place

**Files:** `usage-stage/components/source-panel/*`, `usage-stage/components/usage-editor/*` (+ specs), `usage-stage/services/usage-editor-state.ts` only if a helper is needed.

- [ ] Tests: the panel has no `form`, «Guardar cambios», «Cancelar» or «Cambiar fuente» button; the percentage cell emits `setPercentage {id, percentage}`; the editor saves it at once (`api.save` with `edits: [{id, percentage}]`); clicking the name opens the picker in replace mode and choosing saves at once; a row whose unit isn't kWh shows «Corregir a kWh» and clicking it saves `repair_unit: true`; `test_failed_save_leaves_no_draft` (error shown on the card, `store.dirty` false afterwards); controls disabled while pending.
- [ ] Run → FAIL; implement; run → PASS; commit `feat(uso): edit sources and percentages in place`.

### Task 4: Annual consumption in place

**Files:** `usage-stage/components/annual-consumption/*`, `usage-editor` (+ specs).

- [ ] Tests: no `form`, «Guardar» or «Cancelar»; the cell saves `annual: {quantity}` at once; unit not kWh shows «Corregir a kWh» which saves `repair_unit: true` with the saved quantity; negative saved consumption shows the recalculation notice and an in-place save sends the source edits (confirmation implied); the % asignado line stays.
- [ ] Run → FAIL; implement; run → PASS; full suite + production build; commit `feat(uso): annual consumption in place`.
