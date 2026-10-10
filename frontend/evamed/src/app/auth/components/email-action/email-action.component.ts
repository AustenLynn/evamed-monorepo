import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

const MODES = ['verifyEmail', 'resetPassword', 'recoverEmail'];

// Where Firebase's email links land (custom action URL, set in the Firebase
// console). Firebase appends mode and oobCode; each mode has its own handler.
@Component({
  selector: 'app-email-action',
  templateUrl: './email-action.component.html',
  styleUrls: [
    '../recover-password/recover-password/recover-password.component.scss',
    '../verify-email/verify-email.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EmailActionComponent {
  readonly mode: string | null;
  readonly oobCode: string | null;

  constructor(
    route: ActivatedRoute,
    private router: Router
  ) {
    const params = route.snapshot.queryParamMap;
    this.mode = params.get('mode');
    this.oobCode = params.get('oobCode');
  }

  get handled(): boolean {
    return !!this.oobCode && MODES.includes(this.mode ?? '');
  }

  login(): void {
    this.router.navigate(['/auth/login']);
  }

  about(): void {
    this.router.navigate(['/auth/about']);
  }
}
