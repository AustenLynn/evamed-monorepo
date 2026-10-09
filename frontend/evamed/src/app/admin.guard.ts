import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

import { AuthService } from './core/services/auth.service';

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
          await this.authService.ensureVerifiedToken().catch(() => undefined);
          return true;
        }
        // They may have just clicked the link in another tab.
        const verified = await this.authService.refreshVerification().catch(() => false);
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
