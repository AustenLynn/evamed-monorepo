import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EndLifeStageRoutingModule } from './end-life-stage-routing.module';
import { EndLifeStageComponent } from './components/end-life-stage/end-life-stage.component';
import { SharedModule } from '../shared/shared.module';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from './../material/material.module';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IntermedialComponent } from './components/intermedial/intermedial.component';
import { PassStepComponent } from './components/pass-step/pass-step.component';
import { EndLifeUpdateComponent } from './components/end-life-update/end-life-update.component';

@NgModule({
    declarations: [
        EndLifeStageComponent,
        EndLifeUpdateComponent,
        IntermedialComponent,
        PassStepComponent
    ],
    imports: [
        CommonModule,
        EndLifeStageRoutingModule,
        SharedModule,
        FormsModule,
        MaterialModule,
        MatTooltipModule,
    ],
    exports: [IntermedialComponent, PassStepComponent]
})
export class EndLifeStageModule {}
