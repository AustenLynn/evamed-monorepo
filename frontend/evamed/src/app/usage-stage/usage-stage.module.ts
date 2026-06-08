import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsageStageRoutingModule } from './usage-stage-routing.module';
import { UsageStageComponent } from './components/usage-stage/usage-stage.component';
import { SharedModule } from '../shared/shared.module';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from './../material/material.module';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IntermedialComponent } from './components/intermedial/intermedial.component';
import { PassStepComponent } from './components/pass-step/pass-step.component';
import { UsageStageUpdateComponent } from './components/usage-stage-update/usage-stage-update.component';

@NgModule({
    declarations: [
        UsageStageComponent,
        UsageStageUpdateComponent,
        IntermedialComponent,
        PassStepComponent
    ],
    imports: [
        CommonModule,
        UsageStageRoutingModule,
        SharedModule,
        FormsModule,
        MaterialModule,
        MatTooltipModule,
    ],
    exports: [IntermedialComponent, PassStepComponent]
})
export class UsageStageModule {}
