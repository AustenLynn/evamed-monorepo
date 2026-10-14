import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ExplorerRoutingModule } from './explorer-routing.module';
import { ExplorerUiModule } from './explorer-ui.module';
import { ExplorerPageComponent } from './components/explorer-page/explorer-page.component';
import { MaterialDetailPageComponent } from './components/material-detail-page/material-detail-page.component';
import { StageTabsComponent } from './components/stage-tabs/stage-tabs.component';

@NgModule({
  declarations: [ExplorerPageComponent, MaterialDetailPageComponent, StageTabsComponent],
  imports: [CommonModule, ExplorerUiModule, ExplorerRoutingModule],
})
export class ExplorerModule {}
