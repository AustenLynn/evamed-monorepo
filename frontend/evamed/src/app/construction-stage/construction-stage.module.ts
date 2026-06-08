import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConstructionStageRoutingModule } from './construction-stage-routing.module';
import { ConstructionStageComponent } from './components/construction-stage/construction-stage.component';
import { SharedModule } from '../shared/shared.module';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from './../material/material.module';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IntermedialComponent } from './components/intermedial/intermedial.component';
import { PassStepComponent } from './components/pass-step/pass-step.component';
import { ConstructionStageUpdateComponent } from './components/construction-stage-update/construction-stage-update.component';

@NgModule({
    declarations: [
        ConstructionStageComponent,
        ConstructionStageUpdateComponent,
        IntermedialComponent,
        PassStepComponent
    ],
    imports: [
        CommonModule,
        ConstructionStageRoutingModule,
        SharedModule,
        FormsModule,
        MaterialModule,
        MatTooltipModule,
    ],
    exports: [IntermedialComponent, PassStepComponent]
})
export class ConstructionStageModule {}
