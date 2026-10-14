import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ExplorerPageComponent } from './components/explorer-page/explorer-page.component';
import { STAGES } from './stage-config';

const routes: Routes = [
  { path: '', redirectTo: 'produccion', pathMatch: 'full' },
  ...STAGES.map(stage => ({
    path: stage.key,
    component: ExplorerPageComponent,
    data: { stage: stage.key },
  })),
  { path: '**', redirectTo: 'produccion' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ExplorerRoutingModule {}
