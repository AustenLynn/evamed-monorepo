import { requiresProject } from '../core/services/active-project/requires-project.guard';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EndLifeStageComponent } from './components/end-life-stage/end-life-stage.component';
import { EndLifeUpdateComponent } from './components/end-life-update/end-life-update.component';


const routes: Routes = [
  {
    path: '',
    component: EndLifeStageComponent
  },
  {
    path: 'update',
    canActivate: [requiresProject('stage')],
    component: EndLifeUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EndLifeStageRoutingModule { }
