import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from '../material/material.module';
import { ExplorerBrowserComponent } from './components/explorer-browser/explorer-browser.component';
import { ExplorerPickerComponent } from './components/explorer-picker/explorer-picker.component';
import { FilterPanelComponent } from './components/filter-panel/filter-panel.component';
import { ImpactBadgeComponent } from './components/impact-badge/impact-badge.component';
import { MaterialDetailComponent } from './components/material-detail/material-detail.component';
import { MaterialEditComponent } from './components/material-edit/material-edit.component';
import { MaterialPanelEditComponent } from './components/material-panel-edit/material-panel-edit.component';
import { ResultCardComponent } from './components/result-card/result-card.component';
import { ResultsCardsComponent } from './components/results-cards/results-cards.component';
import { RegionChipComponent } from './components/region-chip/region-chip.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { SourceChipComponent } from './components/source-chip/source-chip.component';
import { GwpPipe } from './pipes/gwp.pipe';

const COMPONENTS = [
  ExplorerBrowserComponent,
  ExplorerPickerComponent,
  FilterPanelComponent,
  ImpactBadgeComponent,
  MaterialDetailComponent,
  MaterialEditComponent,
  MaterialPanelEditComponent,
  RegionChipComponent,
  ResultCardComponent,
  ResultsCardsComponent,
  ResultsTableComponent,
  SourceChipComponent,
  GwpPipe,
];

/** The explorer's pieces without its routes: the routed pages and the stage pages' picker share them. */
@NgModule({
  declarations: COMPONENTS,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MaterialModule],
  exports: [...COMPONENTS, MaterialModule],
})
export class ExplorerUiModule {}
