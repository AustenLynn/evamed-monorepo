import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeEvamedRoutingModule } from './home-evamed-routing.module';
import { HomeEvamedComponent } from './components/home-evamed/home-evamed.component';
import { SharedModule } from './../shared/shared.module';
import { MaterialModule } from './../material/material.module';
import { AddNewProjectComponent } from './components/add-new-project/add-new-project.component';
import { ChooseTypeOfProjectComponent } from './components/choose-type-of-project/choose-type-of-project.component';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChangeNameProjectComponent } from './components/change-name-project/change-name-project.component';
import { MatTooltipModule } from '@angular/material/tooltip';

@NgModule({
    declarations: [
        //HomeEvamedComponent,
        AddNewProjectComponent,
        ChooseTypeOfProjectComponent,
        ChangeNameProjectComponent,
    ],
    imports: [
        CommonModule,
        SharedModule,
        HomeEvamedRoutingModule,
        HomeEvamedComponent,
        MaterialModule,
        FormsModule,
        MatTabsModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatButtonToggleModule,
        MatTooltipModule,
    ],
    providers: [provideCharts(withDefaultRegisterables())],
    exports: [
        HomeEvamedComponent,
        AddNewProjectComponent,
        ChooseTypeOfProjectComponent,
        ChangeNameProjectComponent,
    ]
})
export class HomeEvamedModule {}
