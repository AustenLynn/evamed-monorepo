import { Component, HostListener, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';

// Firebase throttles repeated verification emails (auth/too-many-requests).
export const RESEND_COOLDOWN_MS = 60_000;

// Where AdminGuard sends a signed-in user whose email isn't verified yet. They
// stay here until they click the link Firebase emailed them.
@Component({
    selector: 'app-verify-email',
    templateUrl: './verify-email.component.html',
    // Same layout as the other auth pages, plus link-styled buttons.
    styleUrls: [
      '../recover-password/recover-password/recover-password.component.scss',
      './verify-email.component.scss',
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  email: string | null = null;
  checking = false;
  notYetVerified = false;
  canResend = true;
  private sub: Subscription;
  // Set by a click on "Ya verifiqué mi correo": the running (or next) check
  // reports its outcome. Focus re-checks alone stay silent.
  private reportOutcome = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
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
        this.enterPlatform();
        return;
      }
      this.email = user.email;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
  // Back to the page AdminGuard intercepted, if it's a page of this app.
  private enterPlatform(): void {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const isAppPage = !!requested && /^\/(?![\/\\])/.test(requested) && !requested.startsWith('/auth');
    if (isAppPage) {
      this.router.navigateByUrl(requested);
    } else {
      this.router.navigate(['/']);
    }
  }


  // Coming back from the verification email in another tab.
  @HostListener('window:focus')
  onFocus(): void {
    this.check();
  }

  // Mobile tab switches often skip window focus; visibility is reliable there.
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.check();
    }
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
        this.enterPlatform();
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
    if (!this.canResend) {
      return;
    }
    this.canResend = false;
    this.authService
      .resendVerification()
      .then(() => {
        this.snackBar.open('Te enviamos un nuevo correo de verificación.', 'OK', { duration: 4000 });
        setTimeout(() => (this.canResend = true), RESEND_COOLDOWN_MS);
      })
      .catch(() => {
        this.snackBar.open('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
        this.canResend = true;
      });
  }

  logout(): void {
    this.authService.logout().then(() => this.router.navigate(['/auth/login']));
  }

  about(): void {
    this.router.navigate(['/auth/about']);
  }
}
