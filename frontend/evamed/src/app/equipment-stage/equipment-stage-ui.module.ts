import { ExplorerUiModule } from '../explorer/explorer-ui.module';
import { EvUiModule } from '../shared/ui/ui.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { EquipmentPickerComponent } from './equipment-picker.component';
import { EquipmentStagePanelComponent } from './equipment-stage-panel.component';

import { SharedModule } from '../shared/shared.module';

@NgModule({declarations: [EquipmentPickerComponent, EquipmentStagePanelComponent], imports: [ExplorerUiModule, EvUiModule, CommonModule, FormsModule, MaterialModule, SharedModule], exports: [EquipmentStagePanelComponent]})
export class EquipmentStageUiModule {}
