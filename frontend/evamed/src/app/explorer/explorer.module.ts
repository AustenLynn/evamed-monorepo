import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { MaterialModule } from '../material/material.module';
import { ExplorerRoutingModule } from './explorer-routing.module';
import { ExplorerBrowserComponent } from './components/explorer-browser/explorer-browser.component';
import { ExplorerPageComponent } from './components/explorer-page/explorer-page.component';
import { FilterPanelComponent } from './components/filter-panel/filter-panel.component';
import { ImpactBadgeComponent } from './components/impact-badge/impact-badge.component';
import { ResultCardComponent } from './components/result-card/result-card.component';
import { ResultsCardsComponent } from './components/results-cards/results-cards.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { SourceChipComponent } from './components/source-chip/source-chip.component';
import { StageTabsComponent } from './components/stage-tabs/stage-tabs.component';
import { GwpPipe } from './pipes/gwp.pipe';

@NgModule({
  declarations: [
    ExplorerPageComponent,
    StageTabsComponent,
    ExplorerBrowserComponent,
    FilterPanelComponent,
    ResultsCardsComponent,
    ResultsTableComponent,
    ResultCardComponent,
    ImpactBadgeComponent,
    SourceChipComponent,
    GwpPipe,
  ],
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, ExplorerRoutingModule],
})
export class ExplorerModule {}
