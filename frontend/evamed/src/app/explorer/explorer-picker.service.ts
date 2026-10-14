import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { PickedMaterial, PickerContext } from './picker.models';

/** Opens the explorer full-screen over a stage page (R-20). */
@Injectable({ providedIn: 'root' })
export class ExplorerPickerService {
  constructor(private dialog: MatDialog) {}

  /** Resolves with the chosen material, or undefined if closed. The explorer's code loads on first use. */
  async pick(context: PickerContext): Promise<PickedMaterial | undefined> {
    const { ExplorerPickerComponent } = await import('./components/explorer-picker/explorer-picker.component'),
      ref = this.dialog.open<unknown, PickerContext, PickedMaterial>(ExplorerPickerComponent, {
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
