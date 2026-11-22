import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { UserService } from './core/services/user/user.service';

/**
 * Admin pages are for administrators only (audit A-19, 2026-11-22). The API
 * decides (`/me/` is_admin, set with grant_admin) and also refuses their writes;
 * this keeps everyone else from seeing "Eliminar" buttons that would fail.
 * Runs after AuthGuard, so the user is signed in and verified.
 */
@Injectable({ providedIn: 'root' })
export class IsAdminGuard {
  constructor(private users: UserService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    const home = this.router.parseUrl('/home-evamed');
    return this.users.getMe().pipe(
      map(me => (me?.is_admin === true ? true : home)),
      catchError(() => of(home))
    );
  }
}
