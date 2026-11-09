import { NgModule } from '@angular/core';
import { MenuShellComponent } from './menu-shell.component';
import { SelectionTrayComponent } from './selection-tray.component';
/** Visual roles use opt-in ev* attributes; no global Material control overrides. */
@NgModule({imports: [MenuShellComponent, SelectionTrayComponent], exports: [MenuShellComponent, SelectionTrayComponent]})
export class EvUiModule {}
