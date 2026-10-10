import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AboutComponent } from './components/about/about.component';

import { MaterialModule } from './../material/material.module';
import { SharedModule } from './../shared/shared.module';
import { RecoverPasswordComponent } from './components/recover-password/recover-password/recover-password.component';
import { CompleteProfileComponent } from './components/complete-profile/complete-profile.component';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';
import { VerifyEmailActionComponent } from './components/email-action/verify-email-action.component';
import { ResetPasswordActionComponent } from './components/email-action/reset-password-action.component';
import { RecoverEmailActionComponent } from './components/email-action/recover-email-action.component';
import { PasswordRequirementsComponent } from './components/password-requirements/password-requirements.component';

@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    RecoverPasswordComponent,
    CompleteProfileComponent,
    VerifyEmailComponent,
    PasswordRequirementsComponent,
    VerifyEmailActionComponent,
    ResetPasswordActionComponent,
    RecoverEmailActionComponent,
    AboutComponent,
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    SharedModule,
    MaterialModule,
    ReactiveFormsModule,
  ],
})
export class AuthModule {}
