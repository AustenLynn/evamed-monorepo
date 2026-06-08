import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OthersAdminRoutingModule } from './others-admin-routing.module';
import { OthersAdminComponent } from './components/others-admin/others-admin.component';
import { SharedModule } from '../shared/shared.module';
import { MaterialModule } from '../material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';


@NgModule({
  declarations: [OthersAdminComponent],
  imports: [
    CommonModule,
    OthersAdminRoutingModule,
    SharedModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [provideCharts(withDefaultRegisterables())],
})
export class OthersAdminModule { }
