# Excel Templates with the Current Catalogue: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Both Excel templates are built at download time with every material in EVAMED's catalogue.
Uploading a file built this way is rejected only when it uses a material that has since been
renamed or removed.

**Architecture:**
- A stdlib-only builder in `projects_api/excel_templates/` rewrites the data rows of the hidden BD
  sheet's `BaseDatos` table inside the stored `.xlsm`. It copies every other part byte for byte.
- A read-only endpoint serves the result.
- On the frontend, the download buttons call that endpoint. The upload page checks marked files
  against the current catalogue.

**Tech Stack:** Django 5.2 / DRF (`zipfile`, `re`, `xml.sax.saxutils`); Angular 22 NgModule, SheetJS
(`xlsx`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-excel-template-catalogue-design.md`

## Global Constraints

- No new dependencies, frontend or backend. No openpyxl.
- Never change macros (`xl/vbaProject.bin`), `xl/activeX/*`, slicers, drawings, styles, sheet
  protection, or any sheet other than BD.
- Spanish UI text. Lint must be clean on touched frontend files:
  `npx -y -p node@22 npx eslint <files>`.
- Frontend tests: `cd frontend/evamed && npx -y -p node@22 node node_modules/@angular/cli/bin/ng.js test --watch=false`.
  Always run the full suite.
- Backend tests run only in CI (`python manage.py test`). There is no local Django. Pure-Python
  helpers can be smoke-tested locally with `python3 -I`.
- Capacity: **992** materials (Windows), **996** (Mac).
- Marker: defined name **`EVAMED_CATALOGO`**, holding an ISO 8601 UTC build time.
- Download names: **`Formato Windows.xlsm`** and **`Formato MAC.xlsm`**.
  Content type: `application/vnd.ms-excel.sheet.macroEnabled.12`.

## Template facts the builder relies on

These were verified by unpacking both files.

| | Windows | Mac |
|---|---|---|
| BD sheet part | `xl/worksheets/sheet15.xml` | `xl/worksheets/sheet16.xml` |
| `BaseDatos` table part | `xl/tables/table2.xml` | `xl/tables/table2.xml` |
| Table ref today | `A5:AH351` | `A5:AH375` |
| Extra row-6 cell | none | `AJ6`: `<f t="array" ref="AJ6:AJ375">_xlfn._xlws.FILTER(...)</f>` |
| Search cells to clear | `AH2` | `AH2` (holds a value today), `AJ4` |

- Look up the sheet part from `xl/workbook.xml` (`<sheet name="BD" … r:id>`) and
  `xl/_rels/workbook.xml.rels`. Look up the table part by `name="BaseDatos"` in `xl/tables/*.xml`.
  Don't hard-code the part names: the table above is for the tests only.
- The table header is row 5, and data starts at row 6.
- In row 6, columns B–M are values, A/AF/AG/AH are formulas, and N–V carry style only.
- Row-relative formulas, with `{r}` meaning the row number:
  - A: `BaseDatos[[#This Row],[Material]]`
  - AF: `--ISNUMBER(IFERROR(SEARCH($AH$2,BaseDatos[[#This Row],[Material]],1),""))`
  - AG: `IF(AF{r}=1,COUNTIF($AF$6:AF{r},1),"")`
  - AH: `IFERROR(INDEX(BaseDatos[Material],MATCH(ROWS($AG$6:AG{r}),BaseDatos[Aux2],0)),"")`
- `xl/workbook.xml` has `<calcPr calcId="191029"/>`. `xl/calcChain.xml` exists in both files.

## Review Focus

1. **Names containing `&`, `<`, `"` or non-ASCII characters** (for example `Block 15×20×40 & mortero`).
   They must be XML-escaped in the cells and round-trip exactly. Test this in Task 1.
2. **A catalogue smaller than the template's old row count.** Every old row past the new end must
   be gone, including the Mac spill cells AJ7 and below. Test this in Task 1.
3. **A marked upload whose BD sheet carries the downloader's typed search text in `AH2`/`AJ4`.**
   Only column E below the header row counts as the file's catalogue. Test this in Task 4.
4. **Duplicate or whitespace-padded names in the catalogue**, or `name_material` set to null.
   - Null or blank names are skipped.
   - Duplicates are written once each, as they are.
   - Names are compared exactly when checked: no trimming beyond what SheetJS returns.

   Test this in Task 2 (skip null/blank) and Task 4 (exact compare).
5. **A catalogue fetch error during the upload check.** Continuar stays disabled, an error shows,
   and nothing is stored. Test this in Task 4.

---

### Task 1: Workbook builder

**Files:**
- Move: `frontend/evamed/src/assets/files/EVAMED_WINDOWS.xlsm` and `EVAMED_MAC.xlsm` →
  `backend/evamed-api/projects_api/excel_templates/` using `git mv`. Keep the bytes unchanged.
- Create: `backend/evamed-api/projects_api/excel_templates/__init__.py`
- Create: `backend/evamed-api/projects_api/excel_templates/build.py`
- Test: `backend/evamed-api/projects_api/tests_excel_templates.py`

**Interfaces:**
- Produces:
  - `TEMPLATES = {'windows': ('EVAMED_WINDOWS.xlsm', 992), 'mac': ('EVAMED_MAC.xlsm', 996)}`
  - `class CatalogueRow(NamedTuple)` with fields `base, categoria, tipo, material, unidad,
    administrador, region, descripcion`. All are `str`; use `''` for empty.
  - `class TooManyMaterials(Exception)`
  - `build_template(kind: str, rows: list[CatalogueRow], built_at: datetime) -> bytes`. It raises
    `KeyError` for an unknown kind, and `TooManyMaterials` when `len(rows)` is over the limit.

- [ ] **Step 1: Write the failing tests.** Use `SimpleTestCase`, `class BuildTemplateTests`.
  Add a helper `parts(data) -> dict[str, bytes]` that reads the output zip. Run every test for both
  kinds with `subTest`.
  - `test_every_xml_part_is_well_formed`: `xml.dom.minidom.parseString` succeeds on every `.xml`
    or `.rels` part.
  - `test_other_parts_unchanged`: `xl/vbaProject.bin`, every `xl/activeX/*` part, `xl/styles.xml`
    and every non-BD worksheet are byte-equal to the template.
  - `test_rows_written`: given 3 rows, the BD sheet XML has rows 6, 7 and 8.
    - E7 is an inline string equal to `rows[1].material`.
    - A8, AF8, AG8 and AH8 contain the formulas from "Template facts" with `{r}=8`.
    - There is no `<row r="9"`.
  - `test_escapes_text`: the material `'Block 15×20×40 & mortero <"x">'` round-trips. Parse the
    BD XML and read the `E6` `<is><t>` text.
  - `test_table_ref_matches`: the `BaseDatos` table `ref` and its `autoFilter ref` are `A5:AH8`.
  - `test_mac_spill_ref`: for `mac`, the `AJ6` formula keeps its text, its `ref` is `AJ6:AJ8`, and
    no `AJ7` cell exists.
  - `test_search_cells_cleared`: `AH2`, and `AJ4` on Mac, have no `<v>` and no `<is>`.
  - `test_recalc_on_open`: `workbook.xml` contains `fullCalcOnLoad="1"`. `xl/calcChain.xml`, its
    relationship and its `[Content_Types].xml` override are all gone.
  - `test_marker`: `workbook.xml` has `<definedName name="EVAMED_CATALOGO">"2026-10-27T20:00:00Z"</definedName>`
    for `built_at=datetime(2026,10,27,20,tzinfo=timezone.utc)`.
  - `test_limit`: 993 rows for `windows` raise `TooManyMaterials`. 996 rows for `mac` don't.
  - `test_unknown_kind`: `build_template('linux', [], …)` raises `KeyError`.

- [ ] **Step 2: Smoke-run the module locally.** CI is the real test run.
  - Command: `cd backend/evamed-api && python3 -I -c "import sys; sys.path.insert(0,'.'); from projects_api.excel_templates.build import build_template"`
  - Expected: `ModuleNotFoundError` (or `ImportError`) before Step 3.

- [ ] **Step 3: Implement `build.py`.**
  - Read the template from the package directory and rewrite it with `zipfile` (`ZIP_DEFLATED`).
    Copy each unchanged entry's bytes as they are.
  - BD sheet:
    - Use the row-6 cells as the per-column pattern (their `r` column letters and `s` styles).
    - Emit one `<row r="{r}" spans=…>` per catalogue row:
      - B–F and K–M as `t="inlineStr"` with `<is><t xml:space="preserve">` (escape with
        `xml.sax.saxutils.escape`).
      - G–J empty, styled.
      - A/AF/AG/AH as `<f>` with no cached `<v>`.
      - On Mac, row 6 also gets the AJ6 array formula with the new ref.
    - Replace everything from `<row r="6"` to `</sheetData>`.
    - Set `<dimension ref>` to `A1:AH{5+n}` (Windows) or `A1:AJ{5+n}` (Mac).
    - Blank the AH2/AJ4 cells, keeping their `s`.
  - With zero rows, still write row 6 with empty values. A table needs one data row.
  - Field mapping (spec §3), with `n = len(rows)`:

    | Column | Field |
    |---|---|
    | B | `base` |
    | C | `categoria` |
    | D | `tipo` |
    | E | `material` |
    | F | `unidad` |
    | K | `administrador` |
    | L | `region` |
    | M | `descripcion` |

- [ ] **Step 4: Check locally on the real files.**
  - Build each kind with 3 rows from a short `python3 -I` script.
  - Unzip the result. Run the `minidom` parse over every part and check the table ref.
  - Expected: no exceptions, and ref `A5:AH8`.

- [ ] **Step 5: Commit.** `git mv` the two files, then commit with
  `feat(templates): build the Excel templates with a given catalogue`.

### Task 2: Catalogue rows and the download endpoint

**Files:**
- Modify: `backend/evamed-api/projects_api/excel_templates/build.py`. Add `catalogue_rows`.
- Create: `backend/evamed-api/projects_api/excel_templates/views.py`
- Modify: `backend/evamed-api/projects_api/urls.py`. Add the path before `include(router.urls)`.
- Test: `backend/evamed-api/projects_api/tests_excel_templates.py`

**Interfaces:**
- Consumes: `build_template`, `CatalogueRow`, `TooManyMaterials`, `TEMPLATES` from Task 1;
  `explorer.derive.category(name)` and `explorer.derive.region(name)`.
- Produces:
  - `catalogue_rows() -> list[CatalogueRow]`.
    - Every `Material` with a non-blank `name_material`.
    - Sorted A→Z by `name_material.casefold()`.
    - Field values:

      | Field | Value |
      |---|---|
      | `base` | `database_from or ''` |
      | `categoria` | `category(name) or ''` |
      | `tipo` | `''` |
      | `unidad` | `unit_id.name_unit or ''` |
      | `administrador` | `''` |
      | `region` | `region(name) or '-'` |
      | `descripcion` | `description or ''` |

  - `GET /api-projects/templates/<str:kind>.xlsm` → `TemplateDownloadView`
    (`permission_classes = (access.IsAdminOrReadOnly,)`). Responses:
    - 200 with the file bytes, the macro content type, and `Content-Disposition: attachment; filename="Formato Windows.xlsm"`
      (or `"Formato MAC.xlsm"`). This route is what the frontend calls in Task 3.
    - 404 for an unknown kind.
    - 500 with `{"detail": "El catálogo tiene más materiales de los que caben en la plantilla."}`
      on `TooManyMaterials`.

- [ ] **Step 1: Write the failing tests.** Use `APITestCase`, `class TemplateDownloadTests`. The
  test data has two Units and three Materials:
  - `'Cemento_Cement, Portland {RoW}| market for cement, Portland | Cut-off, S'` (ECOINVENT 3)
  - `'Block hueco 15x20x40_MX'` (EPiC)
  - one with `name_material=None`

  Tests:
  - `test_rows_sorted_and_mapped`:
    - `catalogue_rows()` has 2 rows, ordered `Block…` then `Cemento…`.
    - The cement row has `categoria='Cemento'` and `region='Resto del mundo'`.
    - The block row has `region='México'`.
  - `test_download_windows`: the GET returns 200, the content type, and a filename containing
    `Formato Windows.xlsm`. Opening the zip, the BD XML contains `Block hueco 15x20x40_MX`.
  - `test_download_unknown_kind_404`.
  - `test_too_many_is_500`: patch `catalogue_rows` to return 993 rows and expect 500 with the
    detail above.

- [ ] **Step 2: Implement** `catalogue_rows`, the view (`APIView.get` returning `HttpResponse`), and
  the URL. Pass `built_at=timezone.now()`.

- [ ] **Step 3: Push to CI on a branch, or wait to run CI with Task 3.**
  - Expected: `tests_excel_templates` passes in the backend job.

- [ ] **Step 4: Commit** `feat(templates): serve the templates with the current catalogue`.

### Task 3: Download buttons use the endpoint

**Files:**
- Modify: `frontend/evamed/src/environments/environment.ts` and `environment.prod.ts`. Add
  `api_template: \`${apiEvamed}/templates/\`` next to the other keys, following their pattern.
- Modify: `frontend/evamed/src/app/to-do-file/components/to-do-file/to-do-file.component.ts`
  (`onDownloadWindows`, `onDownloadMac`).
- Test: `frontend/evamed/src/app/to-do-file/components/to-do-file/to-do-file.component.spec.ts`

**Interfaces:**
- Consumes: the Task 2 route.
- Produces: none.

- [ ] **Step 1: Write the failing tests.** Use `HttpTestingController`.
  - `test 'downloads the Windows template from the server'`: clicking the Windows button calls
    `httpMock.expectOne(environment.api_template + 'windows.xlsm')`. After a flush with a `Blob`,
    `FileSaverService.save` gets `(blob, 'Formato Windows.xlsm')`.
  - The same test for Mac, with `'mac.xlsm'` and `'Formato MAC.xlsm'`.
- [ ] **Step 2: Run the suite.** Expected: these 2 fail.
- [ ] **Step 3: Implement.** Change only the two URLs. `MATED.zip` stays on `assets/files`.
- [ ] **Step 4: Run the full suite and lint the touched files.** Expected: all pass.
- [ ] **Step 5: Commit** `feat(templates): download the templates from the server`.

### Task 4: Upload check for marked files

**Files:**
- Modify: `frontend/evamed/src/app/shared/template-sheets.ts`. Add `fileCatalogue` and
  `outdatedMaterials`.
- Modify: `frontend/evamed/src/app/to-do-file/components/to-do-file/to-do-file.component.ts`
- Test: `frontend/evamed/src/app/shared/template-sheets.spec.ts` and `to-do-file.component.spec.ts`

**Interfaces:**
- Consumes: `bySection()` (existing); `MaterialsService.getMaterials()`, which returns
  `{ name_material: string }[]`.
- Produces:
  - `TEMPLATE_MARKER = 'EVAMED_CATALOGO'`
  - `isGeneratedTemplate(wb: XLSX.WorkBook): boolean`. True when `wb.Workbook?.Names` has that name.
  - `fileCatalogue(wb: XLSX.WorkBook): Set<string>`.
    - Reads sheet `BD` with `header: 1`.
    - Finds the first row whose column E is `'Material'`, then collects the non-empty column E
      values below it.
    - Returns an empty set when there is no BD sheet.
  - `outdatedMaterials(used: Iterable<string>, fileList: Set<string>, current: Set<string>): string[]`.
    Returns the names in `fileList` but not in `current`, distinct and in first-use order.

- [ ] **Step 1: Write the failing tests.**
  - In `template-sheets.spec.ts`:
    - `outdatedMaterials(['A','B','X','A'], new Set(['A','B']), new Set(['A']))` equals `['B']`.
      `'X'` was hand-typed, so it isn't reported.
    - `fileCatalogue` on a book whose BD has `AH2='cem'` and rows `[[], …, ['Llave','Base','Categoria','Tipo','Material'], ['x','EPiC','C','T','Cemento']]`
      returns `Set{'Cemento'}`.
    - `isGeneratedTemplate` is false for a book without `Names`, and true with
      `{ Name: 'EVAMED_CATALOGO', Ref: '"2026-10-27T20:00:00Z"' }`.
  - In `to-do-file.component.spec.ts`, provide `MaterialsService` as a stub returning
    `of([{ name_material: 'Cemento' }])`:
    - `'rejects a new file that uses a renamed material, and names it'`:
      - The book is marked and its BD lists `Cemento` and `Viejo`. Cimentación uses `Viejo`.
      - Expect `.upload-error` to contain `Viejo`, Continuar to be disabled, and `dataProject` to be
        null.
    - `'accepts a new file whose unknown names were typed by hand'`: the book is marked, its BD
      lists `Cemento`, and Cimentación uses `Mío`. Expect Continuar to be enabled.
    - `'checks nothing on a file from before this change'`: the book is unmarked, its BD lists
      `Viejo`, and Cimentación uses `Viejo`. Expect Continuar to be enabled and `getMaterials` not
      called.
    - `'stays disabled when the catalogue cannot be fetched'`: the book is marked and the stub
      returns `throwError(() => new Error())`. Expect `.upload-error`, Continuar disabled, and
      `dataProject` null.
    - Existing specs using unmarked books keep passing unchanged.
- [ ] **Step 2: Run the suite.** Expected: the new tests fail.
- [ ] **Step 3: Implement.**
  - Inject `MaterialsService` into `ToDoFileComponent`'s constructor. `XLSX.read` already exposes
    `wb.Workbook.Names` with no extra options.
  - In `onFileChange`, after `bySection`:
    - If the file is generated, `await firstValueFrom(materialsService.getMaterials())`.
    - Compute the used names from `toRead.data`.
    - If `outdatedMaterials(...)` is non-empty, set `uploadError` and `return` without storing.
  - Turn the `reader.onload` body into an `async` function. Keep `processingFile` handling in
    `finally`.
  - Error copy:
    - Outdated: `'Esta plantilla usa materiales que ya cambiaron de nombre o se eliminaron: {lista}. Descarga la plantilla de nuevo y copia tus filas en ella.'`
      List at most 10 names, then `' y N más'`.
    - Fetch failed: `'No se pudo verificar el catálogo de materiales. Inténtalo de nuevo.'`
- [ ] **Step 4: Run the full suite and lint.** Expected: all pass, and lint is clean on
  `src/app/shared/template-sheets*.ts`.
- [ ] **Step 5: Commit** `feat(templates): reject new templates that use renamed or removed materials`.

### Task 5: Ship and accept

- [ ] **Step 1: Push `main`, then watch CI.** Use the CI-watch command from the session notes.
  - Expected: backend, frontend and deploy all succeed.
- [ ] **Step 2: Check on dev.**
  - `curl -sS -o /tmp/w.xlsm -w '%{http_code} %{content_type}\n' https://dev.evamediber.click/api-projects/templates/windows.xlsm`
    should return `200 application/vnd.ms-excel.sheet.macroEnabled.12`.
  - Unzip it and count the BD data rows. The count should equal dev's materials with a non-blank
    name (436 expected).
- [ ] **Step 3: Owner's manual acceptance in real Excel, Windows and Mac.** Check that:
  - there is no repair prompt;
  - the search finds an ecoinvent material;
  - the Mac dropdown narrows as you type;
  - Registro lists the new rows and its filters work;
  - "Registrar" still copies rows;
  - uploading the filled file works.

  Record the result in the excel-templates memory.
