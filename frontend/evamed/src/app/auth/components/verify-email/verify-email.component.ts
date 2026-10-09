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
  // Set by a click on "Ya verifiqué mi correo": the running (or next) check
  // reports its outcome. Focus re-checks alone stay silent.
  private reportOutcome = false;

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
    this.check();
  }

  confirm(): void {
    // In an unfocused window the click's focus event has already started a
    // silent check; asking it to report means the click still gets an answer.
    this.reportOutcome = true;
    this.check();
  }

  private async check(): Promise<void> {
    if (this.checking || !this.email) {
      return;
    }
    this.checking = true;
    try {
      if (await this.authService.refreshVerification()) {
        this.router.navigate(['/']);
      } else if (this.reportOutcome) {
        this.notYetVerified = true;
      }
    } catch {
      if (this.reportOutcome) {
        this.snackBar.open('No pudimos comprobar la verificación. Intenta nuevamente.', 'OK', { duration: 4000 });
      }
    } finally {
      this.checking = false;
      this.reportOutcome = false;
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
