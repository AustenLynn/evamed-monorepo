import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AuthService } from './../../../core/services/auth.service';

const DISMISS_KEY = 'email-verify-dismissed';

@Component({
    selector: 'app-email-verification-banner',
    templateUrl: './email-verification-banner.component.html',
    styleUrls: ['./email-verification-banner.component.scss'],
    standalone: false
})
export class EmailVerificationBannerComponent implements OnInit, OnDestroy {
  visible = false;
  private sub: Subscription;

  constructor(
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.sub = this.authService.hasUser().subscribe(async user => {
      if (!user) {
        this.visible = false;
        return;
      }
      // Refresh so emailVerified reflects a recent click on the email link.
      await this.authService.reloadCurrentUser();
      this.visible =
        !this.authService.isEmailVerified() &&
        this.authService.isPasswordProvider() &&
        sessionStorage.getItem(DISMISS_KEY) !== 'true';
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  resend(): void {
    this.authService
      .resendVerification()
      .then(() => {
        this.snackBar.open(
          'Te enviamos un nuevo correo de verificación.',
          'OK',
          { duration: 4000 }
        );
      })
      .catch(() => {
        this.snackBar.open(
          'No se pudo enviar el correo. Intenta nuevamente.',
          'OK',
          { duration: 4000 }
        );
      });
  }

  dismiss(): void {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    this.visible = false;
  }
}
