import { Component, HostListener, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';

// Where AdminGuard sends a signed-in user whose email isn't verified yet. They
// stay here until they click the link Firebase emailed them.
@Component({
    selector: 'app-verify-email',
    templateUrl: './verify-email.component.html',
    // Same layout as the other auth pages.
    styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  email: string | null = null;
  checking = false;
  notYetVerified = false;
  private sub: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // hasUser() emits once Firebase has restored the session (also after F5).
    this.sub = this.authService.hasUser().pipe(take(1)).subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth/login']);
        return;
      }
      if (user.emailVerified) {
        this.router.navigate(['/']);
        return;
      }
      this.email = user.email;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Coming back from the verification email in another tab.
  @HostListener('window:focus')
  onFocus(): void {
    this.check(false);
  }

  confirm(): void {
    this.check(true);
  }

  private async check(reportOutcome: boolean): Promise<void> {
    if (this.checking || !this.email) {
      return;
    }
    this.checking = true;
    try {
      if (await this.authService.refreshVerification()) {
        this.router.navigate(['/']);
      } else if (reportOutcome) {
        this.notYetVerified = true;
      }
    } catch {
      if (reportOutcome) {
        this.snackBar.open('No pudimos comprobar la verificación. Intenta nuevamente.', 'OK', { duration: 4000 });
      }
    } finally {
      this.checking = false;
    }
  }

  resend(): void {
    this.authService
      .resendVerification()
      .then(() => {
        this.snackBar.open('Te enviamos un nuevo correo de verificación.', 'OK', { duration: 4000 });
      })
      .catch(() => {
        this.snackBar.open('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
      });
  }

  logout(): void {
    this.authService.logout().then(() => this.router.navigate(['/auth/login']));
  }

  about(): void {
    this.router.navigate(['/auth/about']);
  }
}
