import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from './../../../environments/environment';

// Our API's origin and path prefix, e.g. http://localhost:8000 + /api-projects/.
// api_projects ends in /projects/ and may be absolute or relative.
const apiBase = new URL(environment.api_projects, window.location.origin);
const apiOrigin = apiBase.origin;
const apiPath = apiBase.pathname.replace(/projects\/$/, '');

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private auth: Auth) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only our API gets the Firebase ID token; other requests (assets,
    // third-party services, stale hard-coded hosts) pass straight through.
    let target: URL;
    try {
      target = new URL(req.url, window.location.origin);
    } catch {
      return next.handle(req);
    }
    if (target.origin !== apiOrigin || !target.pathname.startsWith(apiPath)) {
      return next.handle(req);
    }
    // Wait for Firebase to restore a persisted session. Otherwise requests fired
    // during start-up (e.g. home-evamed's constructor) go out without a token
    // and the API answers 401.
    return from(this.auth.authStateReady()).pipe(
      switchMap(() => {
        const user = this.auth.currentUser;
        if (!user) {
          return next.handle(req);
        }
        return from(user.getIdToken()).pipe(
          switchMap(token =>
            next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
          )
        );
      })
    );
  }
}
