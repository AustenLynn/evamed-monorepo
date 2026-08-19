import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from './../../../core/services/user/user.service';
import { AuthService } from './../../../core/services/auth.service';
import { SocialAuthFlowService } from './../../../core/services/social-auth-flow.service';
import { CatalogsService } from './../../../core/services/catalogs/catalogs.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
    standalone: false
})
export class RegisterComponent implements OnInit {
  form: UntypedFormGroup;
  catalogoPaises: any;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private router: Router,
    private authService: AuthService,
    private socialFlow: SocialAuthFlowService,
    private user: UserService,
    private catalogsService: CatalogsService,
    private snackBar: MatSnackBar
  ) {
    this.buildForm();
    this.catalogsService.countriesCatalog().subscribe(data => {
      this.catalogoPaises = data;
    });
  }

  ngOnInit() {}

  register(event: Event) {
    event.preventDefault();

    if (this.form.valid) {
      const value = this.form.value;

      if (value.password !== value.password2) {
        this.snackBar.open('Las contraseñas deben coincidir', 'OK', { duration: 4000 });
        return;
      }

      this.user.addUser(value).subscribe({
        next: () => {
          this.authService
            .createUser(value.email, value.password)
            .then(() => {
              this.authService.verifyEmail();
              this.snackBar.open('Registro correcto', 'OK', { duration: 4000 });
              this.router.navigate(['/auth/login']);
            })
            .catch(() => {
              this.snackBar.open(
                'El correo ya está registrado, usa otro correo',
                'OK',
                { duration: 4000 }
              );
            });
        },
        error: () => {
          this.snackBar.open(
            'Error al registrar el usuario. Intenta nuevamente.',
            'OK',
            { duration: 4000 }
          );
        },
      });
    }
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      institution: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password2: ['', [Validators.required, Validators.minLength(8)]],
      sector: ['', [Validators.required]],
      country: ['', [Validators.required]],
    });
  }

  registerWithGoogle() {
    this.socialFlow.signIn('google').catch(error => {
      // Ignore the user simply closing the Google popup.
      if (error?.code === 'auth/popup-closed-by-user' ||
          error?.code === 'auth/cancelled-popup-request') {
        return;
      }
      this.snackBar.open('No se pudo continuar con Google.', 'OK', { duration: 4000 });
    });
  }

  login() {
    this.router.navigate(['/auth/login']);
  }

  about() {
    this.router.navigate(['/auth/about']);
  }
}
