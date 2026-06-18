import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
    selector: 'app-recover-password',
    templateUrl: './recover-password.component.html',
    styleUrls: ['./recover-password.component.scss'],
    standalone: false
})
export class RecoverPasswordComponent implements OnInit {
  form: UntypedFormGroup;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.buildForm();
  }

  ngOnInit(): void {}

  private buildForm() {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  register() {
    this.router.navigate(['/auth/register']);
  }

  recovery(event: Event) {
    event.preventDefault();
    if (this.form.valid) {
      const value = this.form.value;
      this.authService
        .resetPassword(value.email)
        .then(() => {
          this.snackBar.open(
            'El correo para restablecer la contraseña se ha enviado correctamente',
            'OK',
            { duration: 4000 }
          );
          this.router.navigate(['/']);
        })
        .catch(() => {
          this.snackBar.open('Error. Intenta nuevamente la solicitud.', 'OK', { duration: 4000 });
        });
    }
  }

  about() {
    this.router.navigate(['/auth/about']);
  }
}
