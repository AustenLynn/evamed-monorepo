import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from './../../../core/services/user/user.service';
import { AuthService } from './../../../core/services/auth.service';

@Component({
    selector: 'app-complete-profile',
    templateUrl: './complete-profile.component.html',
    styleUrls: ['./../register/register.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CompleteProfileComponent implements OnInit {
  form: UntypedFormGroup;
  name = '';
  email = '';

  constructor(
    private formBuilder: UntypedFormBuilder,
    private router: Router,
    private authService: AuthService,
    private user: UserService,
    private snackBar: MatSnackBar
  ) {
    this.buildForm();
  }

  ngOnInit() {
    const current = this.authService.currentUser;
    // A Google sign-in is required to reach this page; bounce back if missing.
    if (!current) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.name = current.displayName ?? '';
    this.email = current.email ?? '';
  }

  complete(event: Event) {
    event.preventDefault();

    if (this.form.valid) {
      const value = this.form.value;
      this.user
        .addUser({
          name: this.name,
          email: this.email,
          institution: value.institution,
          sector: value.sector,
          country: value.country,
        })
        .subscribe({
          next: () => {
            this.snackBar.open('Perfil completado', 'OK', { duration: 4000 });
            this.router.navigate(['/']);
          },
          error: () => {
            this.snackBar.open(
              'Error al guardar el perfil. Intenta nuevamente.',
              'OK',
              { duration: 4000 }
            );
          },
        });
    }
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      institution: ['', [Validators.required]],
      sector: ['', [Validators.required]],
      country: ['', [Validators.required]],
    });
  }

  about() {
    this.router.navigate(['/auth/about']);
  }
}
