import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { MaterialDetail } from './explorer.models';
import { PickedMaterial, PickerContext } from './picker.models';

/** Opens the explorer full-screen over a stage page (R-20). */
@Injectable({ providedIn: 'root' })
export class ExplorerPickerService {
  constructor(private dialog: MatDialog) {}

  /** Edit: resolves with the row's new values, or undefined if closed. */
  async pick(context: PickerContext): Promise<PickedMaterial | undefined> {
    return ((await this.open(context)) as PickedMaterial[] | undefined)?.[0];
  }

  /** Add: resolves with every material added (with context.save, every one it saved), or [] if none. */
  async pickMany(context: PickerContext): Promise<PickedMaterial[]> {
    return ((await this.open(context)) as PickedMaterial[] | undefined) ?? [];
  }

  /** Choose: resolves with the catalogue material chosen, or undefined if closed. */
  async choose(context: PickerContext): Promise<MaterialDetail | undefined> {
    return (await this.open({ ...context, mode: 'choose' })) as MaterialDetail | undefined;
  }

  /** The explorer's code loads on first use. */
  private async open(context: PickerContext): Promise<PickedMaterial[] | MaterialDetail | undefined> {
    const { ExplorerPickerComponent } = await import('./components/explorer-picker/explorer-picker.component'),
      ref = this.dialog.open<unknown, PickerContext, PickedMaterial[] | MaterialDetail>(ExplorerPickerComponent, {
        data: context,
        width: '100vw',
        maxWidth: '100vw',
        height: '100dvh',
        panelClass: 'ev-picker-dialog',
        autoFocus: 'dialog',
        ariaLabel: 'Explorador de materiales',
      });
    return firstValueFrom(ref.afterClosed());
  }
}
