import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { isUnusableLink } from './action-errors';

// mode=recoverEmail: undo an email change. EVAmed never changes emails, so
// this is rare; Firebase recommends offering a password reset afterwards.
@Component({
  selector: 'app-recover-email-action',
  templateUrl: './recover-email-action.component.html',
  styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class RecoverEmailActionComponent implements OnInit {
  @Input() oobCode = '';
  state: 'working' | 'done' | 'invalid' | 'error' = 'working';
  email = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.run();
  }

  async run(): Promise<void> {
    this.state = 'working';
    try {
      this.email = (await this.authService.checkActionCode(this.oobCode)).email;
      await this.authService.applyActionCode(this.oobCode);
      this.state = 'done';
    } catch (error) {
      this.state = isUnusableLink(error) ? 'invalid' : 'error';
    }
  }

  sendReset(): void {
    this.authService
      .resetPassword(this.email)
      .then(() => {
        this.snackBar.open('Te enviamos un correo para restablecer tu contraseña.', 'OK', { duration: 4000 });
      })
      .catch(() => {
        this.snackBar.open('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
      });
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }
}
