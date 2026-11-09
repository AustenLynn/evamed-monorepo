import { EvUiModule } from '../shared/ui/ui.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { EquipmentPickerComponent } from './equipment-picker.component';
import { EquipmentStagePanelComponent } from './equipment-stage-panel.component';

@NgModule({declarations: [EquipmentPickerComponent, EquipmentStagePanelComponent], imports: [EvUiModule, CommonModule, FormsModule, MaterialModule], exports: [EquipmentStagePanelComponent]})
export class EquipmentStageUiModule {}
