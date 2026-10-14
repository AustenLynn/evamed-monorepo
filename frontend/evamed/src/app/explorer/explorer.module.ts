import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ExplorerRoutingModule } from './explorer-routing.module';
import { ExplorerPageComponent } from './components/explorer-page/explorer-page.component';
import { StageTabsComponent } from './components/stage-tabs/stage-tabs.component';

@NgModule({
  declarations: [ExplorerPageComponent, StageTabsComponent],
  imports: [CommonModule, ExplorerRoutingModule],
})
export class ExplorerModule {}
