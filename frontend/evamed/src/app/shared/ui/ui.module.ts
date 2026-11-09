import { QuantityDisplayPipe } from './quantity-display.pipe';
import { NgModule } from '@angular/core';
import { MenuShellComponent } from './menu-shell.component';
import { SelectionTrayComponent } from './selection-tray.component';
/** Visual roles use opt-in ev* attributes; no global Material control overrides. */
@NgModule({imports: [MenuShellComponent, SelectionTrayComponent, QuantityDisplayPipe], exports: [MenuShellComponent, SelectionTrayComponent, QuantityDisplayPipe]})
export class EvUiModule {}
