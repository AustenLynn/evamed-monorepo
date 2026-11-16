import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UsageStageComponent } from './components/usage-stage/usage-stage.component';
import { UsageStageUpdateComponent } from './components/usage-stage-update/usage-stage-update.component';


import { UsageDirtyGuard } from './services/usage-dirty.guard';

const routes: Routes = [
  {
    path: '',
    canDeactivate: [UsageDirtyGuard],
    component: UsageStageComponent
  },
  {
    path: 'update',
    canDeactivate: [UsageDirtyGuard],
    component: UsageStageUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsageStageRoutingModule { }
