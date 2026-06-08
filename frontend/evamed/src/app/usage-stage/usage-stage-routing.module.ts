import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UsageStageComponent } from './components/usage-stage/usage-stage.component';
import { UsageStageUpdateComponent } from './components/usage-stage-update/usage-stage-update.component';


const routes: Routes = [
  {
    path: '',
    component: UsageStageComponent
  },
  {
    path: 'update',
    component: UsageStageUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsageStageRoutingModule { }
