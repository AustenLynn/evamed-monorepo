import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Auth } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { AuthService } from './../../../core/services/auth.service';

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
    private auth: Auth,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.sub = this.authService.hasUser().subscribe(user => {
      if (!user) {
        this.visible = false;
        return;
      }
      this.check();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Coming back from the verification email in another tab.
  @HostListener('window:focus')
  onFocus(): void {
    if (this.visible) {
      this.check();
    }
  }

  // The API only trusts a verified email, so an unverified user sees no
  // projects. The banner stays (it can't be dismissed) until they verify.
  private async check(): Promise<void> {
    // Refresh so emailVerified reflects a recent click on the email link.
    await this.authService.reloadCurrentUser();
    const user = this.auth.currentUser;
    if (!user) {
      this.visible = false;
      return;
    }
    if (!user.emailVerified) {
      this.visible = true;
      return;
    }
    this.visible = false;
    // The cached ID token still says email_verified=false for up to an hour,
    // so the API would keep hiding the projects. Force a fresh token and
    // reload once so every request carries it.
    const { claims } = await user.getIdTokenResult();
    if (claims['email_verified'] !== true) {
      await user.getIdToken(true);
      window.location.reload();
    }
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
}
