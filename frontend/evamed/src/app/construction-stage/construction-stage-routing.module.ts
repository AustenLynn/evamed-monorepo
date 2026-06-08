import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ConstructionStageComponent } from './components/construction-stage/construction-stage.component';
import { ConstructionStageUpdateComponent } from './components/construction-stage-update/construction-stage-update.component';


const routes: Routes = [
  {
    path: '',
    component: ConstructionStageComponent
  },
  {
    path: 'update',
    component: ConstructionStageUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConstructionStageRoutingModule { }
