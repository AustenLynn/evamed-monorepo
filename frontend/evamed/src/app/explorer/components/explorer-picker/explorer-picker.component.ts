import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ExplorerItem, ExplorerQuery, MaterialDetail } from '../../explorer.models';
import { PickedMaterial, pickedFrom, PickerContext, PickerInitial, SelectionRow, selectionRow } from '../../picker.models';
import { ExplorerService } from '../../services/explorer.service';
import { StageConfig, stageConfig } from '../../stage-config';
import { ExplorerView } from '../explorer-browser/explorer-browser.component';

type Step =
  | { kind: 'loading' }
  | { kind: 'list' }
  | { kind: 'detail'; id: number }
  | { kind: 'edit'; detail: MaterialDetail }
  | { kind: 'selection' }
  /** One selected material in Edición, for the values the list doesn't show. */
  | { kind: 'edit-row'; detail: MaterialDetail; row: SelectionRow };

/**
 * The explorer as the stage page's material picker (R-20): list → Ficha →
 * Edición → "Agregar material" adds one; ticking several and "Revisar y
 * agregar" adds them together, each with its quantity. State lives here,
 * not in the URL, so the stage page underneath keeps its own.
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
    if (this.step.kind === 'selection' || this.step.kind === 'edit-row') {
      return 'Materiales seleccionados';
    }
    return this.step.kind === 'edit' ? 'Agregar material al proyecto' : 'Explorador de materiales';
  }

  /** Several materials can be added at once, but a project row is edited alone. */
  get selectable(): boolean {
    return this.context.mode !== 'edit';
  }

  get selectionReady(): boolean {
    return this.selection.length > 0 && this.selection.every(row => (row.quantity ?? 0) > 0);
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

  backToDetail(detail: MaterialDetail): void {
    this.go({ kind: 'detail', id: detail.id });
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
    if (!this.selection.length && this.step.kind === 'selection') {
      this.backToList();
    }
  }

  review(): void {
    if (this.step.kind === 'list') {
      this.listScrollTop = this.body.nativeElement.scrollTop;
    }
    this.go({ kind: 'selection' });
  }

  setQuantity(row: SelectionRow, value: string): void {
    const quantity = value === '' ? null : Number(value);
    row.quantity = quantity !== null && Number.isFinite(quantity) ? quantity : null;
  }

  editRow(row: SelectionRow): void {
    this.go({ kind: 'loading' });
    this.explorer.material(row.material.id).subscribe({
      next: detail => this.show({ kind: 'edit-row', detail, row }),
      // The list stays as it was; its quantity box still works.
      error: () => this.show({ kind: 'selection' }),
    });
  }

  /** Edición's starting values for a selected material. */
  rowContext(row: SelectionRow): PickerContext {
    const initial: PickerInitial = {
      comercialName: row.values.comercialName,
      quantity: row.quantity,
      comments: row.values.comments,
      transportOrigin: row.values.transportOrigin,
      distanceOrigin: row.values.distanceOrigin,
      transportEnd: row.values.transportEnd,
      distanceEnd: row.values.distanceEnd,
      replaces: row.values.replaces,
      rowUnit: null,
    };
    return { ...this.context, initial };
  }

  saveRow(row: SelectionRow, picked: PickedMaterial): void {
    const { material, quantity, ...values } = picked;
    row.material = material;
    row.quantity = quantity;
    row.values = values;
    this.go({ kind: 'selection' });
  }

  addSelection(): void {
    if (this.selectionReady) {
      void this.commit(this.selection.map(pickedFrom), true);
    }
  }

  /**
   * Edición's "Agregar material", or a project row's "Guardar cambios". With
   * materials already ticked, it joins them instead of being added alone.
   */
  add(picked: PickedMaterial): void {
    if (this.context.mode === 'edit') {
      this.dialogRef.close([picked]);
    } else if (this.selection.length) {
      const { material, quantity, ...values } = picked,
        displayName = this.step.kind === 'edit' ? this.step.detail.display_name : material.name,
        row: SelectionRow = { material, displayName, quantity, values };
      this.setSelection([...this.selection.filter(other => other.material.id !== material.id), row]);
      this.go({ kind: 'selection' });
    } else {
      void this.commit([picked], false);
    }
  }

  close(): void {
    this.dialogRef.close(this.added.length ? [...this.added] : undefined);
  }

  /** Saves through the stage page when it can; what doesn't save stays here to retry. */
  private async commit(materials: PickedMaterial[], fromSelection: boolean): Promise<void> {
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
