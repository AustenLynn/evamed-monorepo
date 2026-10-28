import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ExplorerItem, ExplorerQuery, MaterialDetail } from '../../explorer.models';
import { PickedMaterial, pickedFrom, PickerContext, SelectionRow, selectionRow } from '../../picker.models';
import { ExplorerService } from '../../services/explorer.service';
import { StageConfig, stageConfig } from '../../stage-config';
import { ExplorerView } from '../explorer-browser/explorer-browser.component';

type Step =
  | { kind: 'loading' }
  | { kind: 'list' }
  | { kind: 'detail'; id: number }
  | { kind: 'edit'; detail: MaterialDetail };

/**
 * The explorer as the stage page's material picker (R-20): list → Ficha →
 * Edición → "Agregar material" adds one; ticked materials are listed in the
 * tray and "Agregar N materiales" adds them at once, with quantity 0 to fill
 * in the stage page's list (R-43). State lives here, not in the URL, so the
 * stage page underneath keeps its own.
 */
@Component({
  selector: 'app-explorer-picker',
  templateUrl: './explorer-picker.component.html',
  styleUrls: ['./explorer-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ExplorerPickerComponent {
  readonly stage: StageConfig = stageConfig('produccion')!;
  step: Step = { kind: 'list' };
  query: ExplorerQuery = { search: '', filters: {} };
  view: ExplorerView = 'tarjetas';
  tablePage = 1;
  /** The materials ticked so far, in the order they were ticked. */
  selection: SelectionRow[] = [];
  selectedIds: ReadonlySet<number> = new Set();
  saving = false;
  /** Names of the materials the last save couldn't add. */
  failedNames: string[] = [];

  @ViewChild('body', { static: true }) body!: ElementRef<HTMLElement>;
  private listScrollTop = 0;
  /** What has been added so far: handed back when the picker closes. */
  private readonly added: PickedMaterial[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly context: PickerContext,
    private dialogRef: MatDialogRef<ExplorerPickerComponent, PickedMaterial[]>,
    private explorer: ExplorerService,
    private cdr: ChangeDetectorRef
  ) {
    // Editing a row with a catalogue material opens Edición at once.
    const id = context.materialId;
    if (context.mode === 'edit' && id) {
      this.step = { kind: 'loading' };
      explorer.material(id).subscribe({
        next: detail => this.show({ kind: 'edit', detail }),
        // The Ficha explains the failure and offers to retry.
        error: () => this.show({ kind: 'detail', id }),
      });
    }
  }

  get title(): string {
    if (this.context.mode === 'edit') {
      return 'Editar material';
    }
    return this.step.kind === 'edit' ? 'Agregar material al proyecto' : 'Explorador de materiales';
  }

  /** Several materials can be added at once, but a project row is edited alone. */
  get selectable(): boolean {
    return this.context.mode !== 'edit';
  }

  onQuery(query: ExplorerQuery): void {
    this.query = query;
    this.tablePage = 1;
  }

  open(item: ExplorerItem): void {
    this.listScrollTop = this.body.nativeElement.scrollTop;
    this.go({ kind: 'detail', id: item.id });
  }

  backToList(): void {
    this.go({ kind: 'list' });
    setTimeout(() => (this.body.nativeElement.scrollTop = this.listScrollTop));
  }

  select(detail: MaterialDetail): void {
    this.go({ kind: 'edit', detail });
  }

  /** Edición's "Cancelar": editing a project row closes the picker; adding goes back to the Ficha. */
  cancelEdit(detail: MaterialDetail): void {
    if (this.context.mode === 'edit') {
      this.close();
    } else {
      this.go({ kind: 'detail', id: detail.id });
    }
  }

  toggle(item: ExplorerItem | MaterialDetail): void {
    if (this.selectedIds.has(item.id)) {
      this.remove(item.id);
    } else {
      this.setSelection([...this.selection, selectionRow(item, this.context.projectLife)]);
    }
  }

  remove(id: number): void {
    this.setSelection(this.selection.filter(row => row.material.id !== id));
  }

  /** "Agregar N materiales": quantities are filled in afterwards, in the stage page's list. */
  addSelection(): void {
    if (this.selection.length) {
      void this.commit(this.selection.map(pickedFrom), true);
    }
  }

  /**
   * Edición's "Agregar material", or a project row's "Guardar cambios". With
   * materials already ticked, it joins them instead of being added alone.
   */
  add(picked: PickedMaterial): void {
    if (this.saving) {
      return;
    }
    if (this.context.mode === 'edit') {
      this.dialogRef.close([picked]);
    } else if (this.selection.length) {
      const { material, quantity, ...values } = picked,
        displayName = this.step.kind === 'edit' ? this.step.detail.display_name : material.name,
        row: SelectionRow = { material, displayName, quantity, values };
      this.setSelection([...this.selection.filter(other => other.material.id !== material.id), row]);
      this.backToList();
    } else {
      void this.commit([picked], false);
    }
  }

  close(): void {
    this.dialogRef.close(this.added.length ? [...this.added] : undefined);
  }

  /** Saves through the stage page when it can; what doesn't save stays here to retry. */
  private async commit(materials: PickedMaterial[], fromSelection: boolean): Promise<void> {
    // A second click while the first save runs would add everything twice.
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.failedNames = [];
    this.cdr.markForCheck();
    const saved = this.context.save
        ? await this.context.save(materials).catch(() => materials.map(() => false))
        : materials.map(() => true),
      failed = materials.filter((_material, index) => !saved[index]);
    this.added.push(...materials.filter((_material, index) => saved[index]));
    this.saving = false;
    if (!failed.length) {
      this.dialogRef.close([...this.added]);
      return;
    }
    this.failedNames = failed.map(material => material.comercialName);
    if (fromSelection) {
      const failedIds = new Set(failed.map(material => material.material.id));
      this.setSelection(this.selection.filter(row => failedIds.has(row.material.id)));
    }
    this.cdr.markForCheck();
  }

  trackRow(_index: number, row: SelectionRow): number {
    return row.material.id;
  }

  private setSelection(rows: SelectionRow[]): void {
    this.selection = rows;
    this.selectedIds = new Set(rows.map(row => row.material.id));
  }

  private show(step: Step): void {
    this.go(step);
    this.cdr.markForCheck();
  }

  private go(step: Step): void {
    this.step = step;
    if (step.kind !== 'list') {
      this.body.nativeElement.scrollTop = 0;
    }
  }
}
