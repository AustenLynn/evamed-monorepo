import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExponentialPipe } from './pipes/exponential/exponential.pipe';
import { HighlightDirective } from './directives/highlight/highlight.directive';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { EnergyBarComponent } from './components/energy-bar/energy-bar.component';
import { EmailVerificationBannerComponent } from './components/email-verification-banner/email-verification-banner.component';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../material/material.module';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    ExponentialPipe,
    HighlightDirective,
    HeaderComponent,
    FooterComponent,
    EnergyBarComponent,
    EmailVerificationBannerComponent
  ],
  exports: [
    ExponentialPipe,
    HighlightDirective,
    HeaderComponent,
    FooterComponent,
    EnergyBarComponent,
    EmailVerificationBannerComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    MatTooltipModule,
    ReactiveFormsModule
  ]
})
export class SharedModule { }
