import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { MaterialStageUpdateComponent } from './components/material-stage-update/material-stage-update.component';

const routes: Routes = [
  {
    path: '',
    component: MaterialsStageComponent
  },
  {
    path: 'update',
    component: MaterialStageUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MaterialsStageRoutingModule { }
