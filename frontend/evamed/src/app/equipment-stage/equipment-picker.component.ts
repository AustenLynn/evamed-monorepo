import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { EquipmentSource } from './equipment.models';
import { EquipmentPickContext } from './equipment-picker.service';

const fold = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
@Component({selector: 'app-equipment-picker', templateUrl: './equipment-picker.component.html', styleUrls: ['./equipment-picker.component.scss'], standalone: false, changeDetection: ChangeDetectionStrategy.OnPush})
export class EquipmentPickerComponent implements OnDestroy {
  sources: EquipmentSource[] = [];
  selected = new Set<number>();
  added: EquipmentSource[] = [];
  search = '';
  type = '';
  view = 'cards';
  loading = true;
  failed = false;
  failedNames: string[] = [];
  saving = false;
  private finishing = false;
  private destroy$ = new Subject<void>();
  constructor(@Inject(MAT_DIALOG_DATA) readonly context: EquipmentPickContext,
    private ref: MatDialogRef<EquipmentPickerComponent>, private catalogue: EquipmentCatalogueService,
    private cdr: ChangeDetectorRef) {
    ref.backdropClick().pipe(takeUntil(this.destroy$)).subscribe(() => this.close());
    ref.keydownEvents().pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (event.key === 'Escape') {event.preventDefault(); this.close();}
    });
    this.load();
  }
  load(): void {
    this.loading = true; this.failed = false;
    this.catalogue.load(this.context.stage).pipe(takeUntil(this.destroy$)).subscribe({
      next: catalogue => {this.sources = catalogue.sources; this.loading = false; this.cdr.markForCheck();},
      error: () => {this.failed = true; this.loading = false; this.cdr.markForCheck();}
    });
  }
  get filtered(): EquipmentSource[] {
    const words = fold(this.search).trim().split(/\s+/).filter(Boolean);
    return this.sources.filter(source => (!this.type || source.type === this.type) && words.every(word => fold(source.name).includes(word)));
  }
  get types(): string[] {return [...new Set(this.sources.map(source => source.type))];}
  get selection(): EquipmentSource[] {return [...this.selected].map(id => this.sources.find(source => source.id === id)!).filter(Boolean);}
  removeSelection(id: number): void {
    const source = this.sources.find(item => item.id === id);
    if (source) this.pick(source);
  }
  pick(source: EquipmentSource): void {
    if (this.saving || this.finishing) return;
    if (this.context.mode === 'replace') {this.finishing = true; this.ref.close(source); return;}
    if (this.selected.has(source.id)) this.selected.delete(source.id); else this.selected.add(source.id);
  }
  async submit(): Promise<void> {
    if (!this.selected.size || this.saving || this.finishing) return;
    this.saving = true; this.failedNames = [];
    const sources = this.selection,
     saved = this.context.save ? await this.context.save(sources).catch(() => sources.map(() => false)) : sources.map(() => true);
    this.added.push(...sources.filter((_source, i) => saved[i]));
    const failed = sources.filter((_source, i) => !saved[i]);
    this.selected = new Set(failed.map(source => source.id)); this.failedNames = failed.map(source => source.name);
    this.saving = false;
    if (!failed.length) {this.finishing = true; this.ref.close([...this.added]);}
    this.cdr.markForCheck();
  }
  close(): void {
    if (this.saving || this.finishing) return;
    this.finishing = true;
    this.ref.close(this.context.mode === 'add' ? [...this.added] : undefined);
  }
  ngOnDestroy(): void {this.destroy$.next(); this.destroy$.complete();}
}
