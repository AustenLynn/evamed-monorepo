import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { EquipmentSource, EquipmentStage } from './equipment.models';

export interface EquipmentPickContext {
  stage: EquipmentStage; section: string; mode: 'add' | 'replace';
  save?: (sources: EquipmentSource[]) => Promise<boolean[]>;
}
@Injectable({providedIn: 'root'})
export class EquipmentPickerService {
  private opening = false;
  constructor(private dialog: MatDialog) {}
  async pickMany(context: EquipmentPickContext): Promise<EquipmentSource[]> {
    return (await this.open({...context, mode: 'add'}) as EquipmentSource[] | undefined) ?? [];
  }
  async choose(context: EquipmentPickContext): Promise<EquipmentSource | undefined> {
    return await this.open({...context, mode: 'replace'}) as EquipmentSource | undefined;
  }
  private async open(context: EquipmentPickContext): Promise<EquipmentSource[] | EquipmentSource | undefined> {
    if (this.opening) return undefined;
    this.opening = true;
    try {
      const {EquipmentPickerComponent} = await import('./equipment-picker.component'),
       ref = this.dialog.open(EquipmentPickerComponent, {
        data: context, width: '100vw', maxWidth: '100vw', height: '75dvh',
        position: {bottom: '0'}, panelClass: 'ev-picker-dialog', disableClose: true,
        autoFocus: 'dialog', ariaLabel: context.mode === 'add' ? 'Agregar equipos' : 'Cambiar equipo',
      });
      return await firstValueFrom(ref.afterClosed());
    } finally { this.opening = false; }
  }
}
