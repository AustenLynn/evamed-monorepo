# Excel templates that always carry the current catalogue

Date: 2026-10-27
Status: written, reviewed by a builder check; awaiting the owner's approval

## Why

People record a project's materials in one of two Excel templates. The Windows template is
`EVAMED_WINDOWS.xlsm` and the Mac one is `EVAMED_MAC.xlsm`. Both are in
`frontend/evamed/src/assets/files/`, and neither has changed since the repo was created. They
fill in the template and upload it on the "Registro de materiales" page (`to-do-file`).

They choose material **names from the template's dropdown**. That is the owner's answer to what
the list is for. A name has to match EVAMED's catalogue (`Material.name_material`) exactly, or the
row isn't recognised on upload.

The list inside both files is frozen at about 350 materials (EPiC, EPDs and, on Mac, Mexican).
It has none of the 67 ecoinvent materials. Dev's catalogue now has 436 materials. Anything added
since the files were made can't be picked.

## Goals

1. Both templates always offer **every material in EVAMED's catalogue**, whatever its database:
   EPiC, EPDs, Mexican, ecoinvent, and anything added, renamed or removed later. This is the
   owner's decision. Nobody has to remember to rebuild a file.
2. A file **downloaded after this change** is rejected on upload **only when it uses a material
   that has since been renamed or removed**. The message names those materials and tells the
   person to download the template again and copy their rows across. This is the owner's
   decision.
3. **Files from before this change keep today's behaviour.** This is the owner's decision. Their
   old lists use older spellings for 86 of 346 Windows names and 14 of 370 Mac names, so a
   rejection rule would block many of them. Instead their unmatched names show as unidentified
   and are fixed with "Cambiar material".

## Non-goals

These are separate fixes, out of scope here:

- **The Windows Origen dropdown.** It offers "Calculado en Dynamo", "Modelo de Revit" and
  "Usuario" (`Parametros!B2:B4`). The app only recognises "Modelo de Revit", "Template EVAMED",
  "Opciones EVAMED" and "Usuario_Plataforma", so rows with the other two values are ignored.
- **The "Registrar" macro.** It copies only Material and Cantidad into a section sheet. It leaves
  Origen empty, so the app ignores those rows.
- **Plain-text passwords** in the Inicio and Parametros sheets and in the macros (`Xls_2020`).
- **Impact values** in the template. The energy, water and CO₂ columns are informational. Nothing
  a user picks from reads them, and the app calculates impacts from its own database.

## Anti-goals

The update fails, even if the list is right, if any of these happens:

- Excel reports the file as damaged or "repaired", or any macro stops working.
- The search boxes stop working: the Windows ActiveX `TempCombo`, or the Mac `FILTER` dropdown.
- The Registro sheet, its filter buttons (slicers), sheet protection or formatting break.
- A file is rejected when all its materials are still valid.
- A file is rejected because someone typed a name by hand. Hand-typed names behave as they do
  today: the row is shown as unidentified and can be fixed with "Cambiar material".

## How the templates work today

This was found by reading both workbooks and their decompressed VBA.

### One table feeds every way of picking a material

The hidden sheet **BD** holds the Excel table **`BaseDatos`**. Its header is row 5 and its data
starts at row 6. Its ref is `A5:AH351` on Windows and `A5:AH375` on Mac.

| Columns | Content |
|---|---|
| A, `Llave` | Calculated: `=BaseDatos[[#This Row],[Material]]` |
| B, `Base` | Database |
| C, `Categoria` | Category |
| D, `Tipo` | Type |
| E, `Material` | Material name |
| F, `Unidad` | Unit |
| G–J | Energy (MJ), Water (L), GHG (kgCO₂e), More information |
| K, `Administrador EPDs` | EPD manager |
| L, `Objetivo Geográfico` | Geography |
| M, `Descripción de Material` | Description |
| N–AE | Unused placeholders ("Por Definir…", "TBD…", "Columna…") |

AF–AH (`Aux1`–`Aux3`) are calculated columns that build a filtered list. AF marks names containing
the search text in `BD!AH2`. AG numbers the matches. AH lists them in order. `BD!AH4` (named
`Tope`) counts the matches.

### How each part reads the table

- **Windows Material cell.**
  - Clicking a Material cell (C5:C103 on each section sheet) shows an ActiveX combo box,
    `TempCombo`.
  - As the person types, the macro writes the text into `BD!AH2`. It then reads `Tope` (`BD!AH4`)
    and loads the matches from `BD!AH6` down.
  - The cell's own data validation is a list over `BD!$AH$6:$AH$1001`.
- **Mac Material cell.**
  - Each section sheet's `Worksheet_SelectionChange` writes the selected cell's value into
    `BD!AJ4`.
  - `BD!AJ6` holds a dynamic-array formula,
    `_xlfn._xlws.FILTER(BaseDatos[Material],ISNUMBER(SEARCH(AJ4,BaseDatos[Material])))`. It spills
    down, and its current ref is `AJ6:AJ375`.
  - The Material cells (C8:C106) validate against `_xlfn.ANCHORARRAY(BD!$AJ$6)`.
  - This needs Excel 365 or 2021.
- **Registro sheet (both files).**
  - It holds the table `Seleccion`: Windows `A12:I1003`, Mac `A17:I1008`.
  - Each row mirrors one BD row with per-cell formulas such as `=IF(BD!E6="","",BD!E6)`. They
    cover BD rows 6 to about 1001.
  - Table slicers filter it by Base, Categoria, Tipo, Administrador EPDs and Objetivo Geográfico.
  - The "Registrar" macro copies the chosen rows into the section sheets.
- **The macros never change.** They refer to BD only through those fixed cells (AH2, AH4, AH6↓,
  AJ4) and through the table names.

**Consequence.** Rewriting the data rows of `BaseDatos` (columns B–M) updates the dropdowns, the
search and Registro together.

**Capacity.** Each template's Registro table (`Seleccion`) has 991 rows: Windows A13:I1003, Mac
A18:I1008. The templates' own formulas skip some BD rows (351 on Windows; 169–172 and 355 on Mac),
so the builder points Registro's n-th row at BD's n-th row. That allows 991 materials in either
template. Dev has 436. *(Corrected 2026-10-28.)*

## The design

### 1. The server builds the template on download

- **New API endpoint** in `projects_api`. Suggested path:
  `GET /api-projects/templates/<windows|mac>.xlsm`.
  - It reads the stored template and writes the current catalogue into `BaseDatos`.
  - It returns the file as `application/vnd.ms-excel.sheet.macroEnabled.12`, with the download
    names used today: `Formato Windows.xlsm` and `Formato MAC.xlsm`.
- **Who can call it.** It follows the catalogue's read rule: `IsAdminOrReadOnly`, so anyone may
  read.
- **Where the templates live.** The two `.xlsm` files move from the frontend's `assets/files/` to
  the backend, for example `projects_api/excel_templates/`. Keep their bytes unchanged.
  `MATED.zip` stays where it is.
- **The download buttons** in `to-do-file` call the new endpoint instead of `assets/files/…`.
- **No caching to start with.** A build is a zip rewrite of one sheet, about 436 rows. *(My call.)*
  Add a cache keyed on the catalogue only if a download takes more than about a second.

### 2. How the workbook is edited

This is the risky part.

- **Approach.** Edit the `.xlsm` package directly with the Python standard library (`zipfile` plus
  XML editing). Copy every other part byte for byte, including `vbaProject.bin`, `activeX/*`,
  drawings, slicers, styles and the other sheets.
- **No new dependencies.** Don't add a dependency such as openpyxl. *(My call: the project avoids
  new dependencies, and openpyxl is known to drop ActiveX controls and slicers.)*
- **Changes inside the package:**
  - **BD sheet XML, rows 6 to the end.**
    - Write one row per material.
    - Use inline strings (`t="inlineStr"`) for text, so `sharedStrings.xml` is left alone.
    - Keep each column's existing cell style (`s=`). Copy it from the template's first data row.
    - Columns A and AF–AH keep their calculated formulas on every row. The formulas use the same
      row-relative pattern as the template's row 6.
    - Remove the template's old data rows.
    - Leave rows 1–5 untouched, except that `AH2` and `AJ4` must be empty.
  - **`tables/<BaseDatos>.xml`.** Set `ref` (and `autoFilter ref`) to `A5:AH{5 + n}`.
  - **Mac only.** Set the `AJ6` spill `ref` to `AJ6:AJ{5 + n}`. Excel recalculates it anyway.
  - **Recalculation.**
    - Set `<calcPr fullCalcOnLoad="1"/>` in `workbook.xml`, so formulas and cached values are
      recalculated when the file is opened.
    - Delete `calcChain.xml`, its relationship and its content-type entry. This avoids
      repair prompts from stale calc chains.
  - **Registro.** Rewrite the mirror formulas `=IF(BD!X{n}="","",BD!X{n})` so that row n of the
    table copies BD row 5+n. Write each one's result as its cached value.
  - **Formula results.** BD's A, AF, AG and AH cells, `AH4` (`Tope`) and the Mac spill also get
    cached values, as if the search box were empty.
    - Excel doesn't recalculate a downloaded file until editing is enabled.
    - Until then, Registro, its filters and the dropdowns show the results the file carries.
    - The first download from dev showed the old list in Registro's filters for this reason.
    *(Added 2026-10-28.)*
  - **Capacity.** If the catalogue has more than 991 materials, the
    endpoint fails with a clear server error instead of producing a file whose lists are cut
    short. *(My call: a limit for each template.)*
  - **Marker.** Add a workbook-level defined name, `EVAMED_CATALOGO`, to `workbook.xml`. Its value
    is a string formula holding the build time in ISO 8601 (UTC), for example
    `"2026-10-27T20:00:00Z"`. The upload page uses it to tell a generated file from an old one.
    *(My call: a defined name is one line in `workbook.xml`, and SheetJS exposes it as
    `wb.Workbook.Names`.)*
- **Sort order.** Rows are written A→Z by name, using the same collation idea as the app's lists.
  *(My call.)*

### 3. What each BD row holds

| BD column | Value |
|---|---|
| B `Base` | `Material.database_from` |
| C `Categoria` | `explorer.derive.category(name)`: the prefix before the first `_`, as the Explorador uses |
| D `Tipo` | Left empty *(my call: the catalogue has no type; the slicer shows "(blank)")* |
| E `Material` | `name_material`, exactly. This is what must match on upload. |
| F `Unidad` | `unit_id.name_unit` |
| G–J | Empty *(non-goal)* |
| K `Administrador EPDs` | Empty *(my call; the catalogue doesn't store it)* |
| L `Objetivo Geográfico` | `explorer.derive.region(name)`, or `-` when there is none (EPiC's value today) |
| M `Descripción de Material` | `Material.description`, or empty |

Materials with an empty or null `name_material` are skipped.

### 4. The upload check

This runs in `to-do-file`, on the upload page, before anything is stored in
`sessionStorage['dataProject']`.

1. Parse the workbook as today, and sort it into sections with `bySection()`.
2. **No `EVAMED_CATALOGO` marker** means the file is from before this change: skip the rest of the
   check. The upload behaves exactly as today.
3. Read **the file's own catalogue**: the `Material` column (E) of sheet `BD`, below the header row
   that contains `Material`.
   - Read it as an array of rows (`sheet_to_json` with `header: 1`). The table header is on row 5,
     so the default object mode would read the wrong keys.
   - A marked file without a `BD` sheet has no list of its own. Every unmatched name in it is
     then treated as hand-typed.
4. Fetch the current catalogue names. `MaterialsService.getMaterials()` is already used by
   `prev-steps`.
5. Collect every non-empty `Material` value from the 11 section sheets.
6. **Outdated names** are names that are in the file's own catalogue but not in the current one.
   - If there are any, the upload is **rejected**:
     - Show an `uploadError` that lists them (up to about 10, then "y N más").
     - Tell the person to download the template again and copy their rows into it.
     - Keep Continuar disabled, and store nothing.
7. Names in neither catalogue were typed by hand. They pass, as today.
8. Names in the current catalogue pass.

New materials never cause a rejection. Files from before this change are never rejected by this
check.

If fetching the catalogue fails for a marked file, show an error ("No se pudo verificar…, inténtalo de nuevo") and
keep Continuar disabled. Don't let the file through unchecked. *(My call.)*

## Constraints

- **Frontend.** Angular 22 NgModule (`standalone: false`), Vitest via `ng test`. Spanish UI text.
  No new dependencies. Lint must be clean on the files touched.
- **Backend.** Django 5.2 and DRF. The tests run in CI only, because there is no local Django.
  No new Python dependencies.
- **Workbooks.** Never change the macros, ActiveX controls, slicers, protection or the other
  sheets.
- **Deploys.** Dev deploys from `main` through CI to Lightsail.

## Testing

- **Backend unit tests, on a generated file from each template:**
  - The zip is valid and every XML part is well-formed.
  - `vbaProject.bin` and the `activeX/` parts are byte-identical to the template.
  - The `BaseDatos` ref matches the catalogue size.
  - BD rows equal the catalogue, A→Z.
  - The A and AF–AH formulas are present on every row.
  - `calcChain` has been removed and `fullCalcOnLoad` is set.
  - The `EVAMED_CATALOGO` defined name is present.
  - More than 991 materials raises an error.
- **Frontend unit tests:**
  - The download buttons call the endpoint.
  - The upload check covers:
    - outdated names in a marked file (rejected, and listed);
    - hand-typed names (pass);
    - new materials (pass);
    - an unmarked old file that uses renamed names (passes, as today);
    - a marked file without a BD sheet;
    - a failed catalogue fetch.
- **Manual acceptance (required).** The generated files must be opened in real Excel on Windows
  and on a Mac:
  - The search box shows an ecoinvent material.
  - The Mac dropdown narrows as you type.
  - Registro lists the new rows and its filters work.
  - "Registrar" still copies rows.
  - No repair prompt appears.

  Claude has no Excel locally. The owner or a teammate does this check.

## Left to the builder

- The endpoint's exact URL, module layout and view class.
- How rows are written: string templates or ElementTree.
- Message wording, within the meaning above.
- Whether to read BD's catalogue with a small helper next to `bySection()` in
  `shared/template-sheets.ts`.
