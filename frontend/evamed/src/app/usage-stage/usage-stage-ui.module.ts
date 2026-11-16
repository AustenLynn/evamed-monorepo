import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { ExplorerUiModule } from '../explorer/explorer-ui.module';
import { EvUiModule } from '../shared/ui/ui.module';
import { AnnualConsumptionComponent } from './components/annual-consumption/annual-consumption.component';
import { UsageSourcePanelComponent } from './components/source-panel/usage-source-panel.component';

import { SharedModule } from '../shared/shared.module';
import { UsageStageShellComponent } from './components/stage-shell/usage-stage-shell.component';

import { UsageSourcePickerComponent } from './components/source-picker/usage-source-picker.component';

const components = [AnnualConsumptionComponent, UsageSourcePanelComponent, UsageStageShellComponent, UsageSourcePickerComponent];
@NgModule({declarations: components, imports: [CommonModule, FormsModule, MaterialModule, SharedModule, ExplorerUiModule, EvUiModule], exports: components})
export class UsageStageUiModule {}
