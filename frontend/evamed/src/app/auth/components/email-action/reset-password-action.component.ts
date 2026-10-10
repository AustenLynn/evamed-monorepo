import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { isUnusableLink } from './action-errors';

// mode=resetPassword: choose a new password, then straight into the platform.
@Component({
  selector: 'app-reset-password-action',
  templateUrl: './reset-password-action.component.html',
  styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ResetPasswordActionComponent implements OnInit {
  @Input() oobCode = '';
  state: 'checking' | 'form' | 'saving' | 'saved' | 'invalid' | 'error' = 'checking';
  email = '';
  form: UntypedFormGroup;
  // Firebase's password policy is met; null when it couldn't be fetched.
  policyMet: boolean | null = null;
  passwordError: string | null = null;
  saveError: string | null = null;

  constructor(
    formBuilder: UntypedFormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = formBuilder.group({
      password: ['', [Validators.required]],
      password2: ['', [Validators.required]],
    });
  }

  get mismatch(): boolean {
    const { password, password2 } = this.form.value;
    return !!password2 && password !== password2;
  }

  ngOnInit(): void {
    this.check();
  }

  async check(): Promise<void> {
    this.state = 'checking';
    try {
      this.email = await this.authService.verifyPasswordResetCode(this.oobCode);
      this.state = 'form';
    } catch (error) {
      this.state = isUnusableLink(error) ? 'invalid' : 'error';
    }
  }

  async save(): Promise<void> {
    const { password, password2 } = this.form.value;
    if (this.state !== 'form' || !password || password !== password2 || this.policyMet === false) {
      return;
    }
    this.state = 'saving';
    this.passwordError = null;
    this.saveError = null;
    try {
      await this.authService.confirmPasswordReset(this.oobCode, password);
    } catch (error) {
      if (isUnusableLink(error)) {
        this.state = 'invalid';
        return;
      }
      this.state = 'form';
      const code = (error as { code?: string } | null)?.code;
      if (code === 'auth/password-does-not-meet-requirements' || code === 'auth/weak-password') {
        this.passwordError = 'La contraseña no cumple los requisitos.';
      } else {
        this.saveError = 'No se pudo guardar. Intenta nuevamente.';
      }
      return;
    }
    try {
      await this.authService.login(this.email, password);
      // The platform finds the profile by this key, as after login.
      localStorage.setItem('email-login', this.email);
      this.router.navigate(['/']);
    } catch {
      this.state = 'saved';
    }
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }

  requestNewLink(): void {
    this.router.navigate(['/auth/recover-password']);
  }
}
