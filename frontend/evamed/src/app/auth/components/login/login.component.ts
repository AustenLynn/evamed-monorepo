import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService, SocialProvider } from 'src/app/core/services/auth.service';
import { SocialAuthFlowService } from 'src/app/core/services/social-auth-flow.service';

// Social providers shown in the login icon row. Apple is intentionally omitted
// (it needs a paid Apple Developer account); add an entry here to enable it.
interface SocialButton {
  key: SocialProvider;
  label: string;
}

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: false
})
export class LoginComponent implements OnInit {
  form: UntypedFormGroup;

  readonly socialButtons: SocialButton[] = [
    { key: 'google', label: 'Continuar con Google' },
    { key: 'facebook', label: 'Continuar con Facebook' },
    // Microsoft and Twitter hidden for now; re-enable by restoring these entries.
    // { key: 'microsoft', label: 'Continuar con Microsoft' },
    // { key: 'twitter', label: 'Continuar con Twitter' },
  ];

  constructor(
    private formBuilder: UntypedFormBuilder,
    private router: Router,
    private authService: AuthService,
    private socialFlow: SocialAuthFlowService,
    private snackBar: MatSnackBar
  ) {
    this.buildForm();
  }

  ngOnInit() {}

  login(event: Event) {
    event.preventDefault();
    if (this.form.valid) {
      const value = this.form.value;
      this.authService
        .login(value.email, value.password)
        .then(() => {
          // The app identifies the current user by this key (e.g. home-evamed
          // and comparar look up the profile via searchUser); it is cleared on
          // logout in AuthService.
          localStorage.setItem('email-login', value.email);
          this.router.navigate(['/']);
        })
        .catch(() => {
          this.snackBar.open('Correo o contraseña no válidos', 'OK', { duration: 4000 });
        });
    }
  }

  loginWith(provider: SocialProvider) {
    this.socialFlow.signIn(provider).catch(error => {
      // Ignore the user simply closing the provider popup.
      if (error?.code === 'auth/popup-closed-by-user' ||
          error?.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (error?.message === 'no-email') {
        this.snackBar.open(
          'Este proveedor no proporcionó un correo electrónico.', 'OK', { duration: 4000 });
        return;
      }
      this.snackBar.open('No se pudo iniciar sesión.', 'OK', { duration: 4000 });
    });
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  register() {
    this.router.navigate(['/auth/register']);
  }

  about() {
    this.router.navigate(['/auth/about']);
  }
}
