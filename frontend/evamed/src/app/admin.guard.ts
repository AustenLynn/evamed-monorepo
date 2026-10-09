import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

import { AuthService } from './core/services/auth.service';

// Firebase calls can take ~30 s to fail when the network is up but Firebase
// isn't reachable; navigation shouldn't wait that long.
export const GUARD_CHECK_TIMEOUT_MS = 5_000;

// `work`'s result, or `fallback` if it fails or takes longer than the limit.
function within<T>(work: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>(resolve => {
    timer = setTimeout(() => resolve(fallback), GUARD_CHECK_TIMEOUT_MS);
  });
  return Promise.race([work.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}

// Guards every platform route, not just admin pages: the user must be signed
// in and have verified their email. /auth/* stays outside it.
@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.authService.hasUser().pipe(
      take(1),
      switchMap(async user => {
        if (!user) {
          return this.router.parseUrl('/auth/login');
        }
        if (user.emailVerified) {
          // A token issued before verification still says email_verified=false.
          await within(this.authService.ensureVerifiedToken(), undefined);
          return true;
        }
        // They may have just clicked the link in another tab.
        const verified = await within(this.authService.refreshVerification(), false);
        return verified ? true : this.verifyPage(state?.url);
      })
    );
  }

  // Keep the page they asked for, so they land there once verified.
  private verifyPage(requested?: string): UrlTree {
    const queryParams = requested && requested !== '/' ? { returnUrl: requested } : {};
    return this.router.createUrlTree(['/auth/verify-email'], { queryParams });
  }
}
