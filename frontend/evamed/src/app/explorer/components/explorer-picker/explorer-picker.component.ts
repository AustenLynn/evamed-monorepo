import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ExplorerItem, ExplorerQuery, MaterialDetail } from '../../explorer.models';
import { PickedMaterial, PickerContext } from '../../picker.models';
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
 * Edición → "Agregar material" closes it with the result. State lives here,
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

  @ViewChild('body', { static: true }) body!: ElementRef<HTMLElement>;
  private listScrollTop = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly context: PickerContext,
    private dialogRef: MatDialogRef<ExplorerPickerComponent, PickedMaterial>,
    explorer: ExplorerService,
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
    return this.context.mode === 'edit' ? 'Editar material' : 'Explorador de materiales';
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

  add(picked: PickedMaterial): void {
    this.dialogRef.close(picked);
  }

  close(): void {
    this.dialogRef.close();
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
