import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { SocialAuthFlowService } from './social-auth-flow.service';
import { UserService } from './user/user.service';

describe('SocialAuthFlowService', () => {
  // A session with no email would sit on the verify page with nothing to verify.
  it('signs out again when the provider gives no email', async () => {
    const auth = {
      loginWithProvider: vi.fn(async () => ({ user: { email: null, emailVerified: false } })),
      logout: vi.fn(async () => undefined),
    };
    const router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UserService, useValue: { searchUser: vi.fn(() => of([])) } },
        { provide: Router, useValue: router },
      ],
    });

    await expect(TestBed.inject(SocialAuthFlowService).signIn('twitter')).rejects.toThrow('no-email');

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
