import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { leaveUsage, UsageStageComponent } from './components/usage-stage/usage-stage.component';
import { UsageStageUpdateComponent } from './components/usage-stage-update/usage-stage-update.component';


const routes: Routes = [
  {
    path: '',
    canDeactivate: [leaveUsage],
    component: UsageStageComponent
  },
  {
    path: 'update',
    canDeactivate: [leaveUsage],
    component: UsageStageUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsageStageRoutingModule { }
