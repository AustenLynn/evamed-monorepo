import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private auth: Auth) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only our API gets the Firebase ID token; other requests (assets,
    // third-party services) pass straight through.
    if (!req.url.includes('/api-projects/')) {
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
