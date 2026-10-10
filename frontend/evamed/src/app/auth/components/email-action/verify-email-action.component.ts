import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { isUnusableLink } from './action-errors';

export const AUTO_ENTER_MS = 2_000;

// mode=verifyEmail: confirm the address, then straight into the platform.
@Component({
  selector: 'app-verify-email-action',
  templateUrl: './verify-email-action.component.html',
  styleUrls: ['../recover-password/recover-password/recover-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class VerifyEmailActionComponent implements OnInit, OnDestroy {
  @Input() oobCode = '';
  state: 'working' | 'done' | 'invalid' | 'error' = 'working';
  signedIn = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.run();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async run(): Promise<void> {
    this.state = 'working';
    // hasUser() emits once Firebase has restored a saved session (fresh tab, F5).
    const user = await firstValueFrom(this.authService.hasUser());
    this.signedIn = !!user;
    try {
      await this.authService.applyActionCode(this.oobCode);
    } catch (error) {
      if (isUnusableLink(error)) {
        await this.linkNoLongerValid();
      } else {
        this.state = 'error';
      }
      return;
    }
    this.state = 'done';
    if (this.signedIn) {
      // Make the token say verified first, so their projects load at once.
      await this.authService.refreshVerification().catch(() => false);
      this.timer = setTimeout(() => this.enter(), AUTO_ENTER_MS);
    }
  }

  // A spent link usually means they already verified: then just go in.
  private async linkNoLongerValid(): Promise<void> {
    if (this.signedIn && (await this.authService.refreshVerification().catch(() => false))) {
      this.enter();
      return;
    }
    this.state = 'invalid';
  }

  enter(): void {
    this.stopTimer();
    this.router.navigate(['/']);
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }

  resend(): void {
    this.router.navigate(['/auth/verify-email']);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
