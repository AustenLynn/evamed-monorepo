import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AuthService, SocialProvider } from './auth.service';
import { UserService } from './user/user.service';

/**
 * Shared social sign-in flow ("Continúa con ...") used by the login and register
 * pages. Signs in with the chosen provider, records the active email (the app
 * identifies the user by the `email-login` localStorage key), then routes to the
 * app when a backend UserPlatform record already exists, or to the
 * profile-completion page when the user is signing in for the first time.
 */
@Injectable({
  providedIn: 'root'
})
export class SocialAuthFlowService {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  async signIn(provider: SocialProvider): Promise<void> {
    const credential = await this.authService.loginWithProvider(provider);
    const email = credential.user?.email;

    // Some providers (Apple private relay, Twitter without email scope) may not
    // return an email. The whole app keys off `email-login` / searchUser(email),
    // so abort rather than corrupt the lookup with a null value.
    if (!email) {
      throw new Error('no-email');
    }
    localStorage.setItem('email-login', email);

    const existing = await lastValueFrom(this.userService.searchUser(email));
    if (existing && existing.length > 0) {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/auth/complete-profile']);
    }
  }
}
