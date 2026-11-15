import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { UsageType } from './usage.models';

export interface UsagePickContext {
  catalogue: UsageType[]; excluded: (number | null)[]; mode: 'add' | 'replace';
  selected?: number[];
  recovering?: () => boolean;
  save?: (sources: UsageType[]) => Promise<boolean>;
}
@Injectable({providedIn: 'root'})
export class UsagePickerService {
  private opening = false;
  constructor(private dialog: MatDialog) {}
  async add(catalogue: UsageType[], excluded: (number | null)[], save: (sources: UsageType[]) => Promise<boolean>, selected: number[] = [], recovering = () => false): Promise<void> {
    await this.open({catalogue, excluded, save, selected, recovering, mode: 'add'});
  }
  async choose(catalogue: UsageType[]): Promise<UsageType | undefined> {
    return this.open({catalogue, excluded: [], mode: 'replace'});
  }
  private async open(context: UsagePickContext): Promise<UsageType | undefined> {
    if (this.opening) return undefined;
    this.opening = true;
    try {
      const {UsagePickerComponent} = await import('./usage-picker.component'),
        ref = this.dialog.open(UsagePickerComponent, {
          data: context, width: '100vw', maxWidth: '100vw', height: '75dvh',
          position: {bottom: '0'}, panelClass: 'ev-picker-dialog', disableClose: true,
          autoFocus: 'dialog', ariaLabel: context.mode === 'add' ? 'Agregar fuentes' : 'Cambiar fuente',
        });
      return await firstValueFrom(ref.afterClosed());
    } finally {this.opening = false;}
  }
}
