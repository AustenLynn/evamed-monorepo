import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { FIREBASE_AUTH } from './../firebase';
import { AuthService } from './auth.service';

describe('AuthService.hasUser', () => {
  it('emits the user that Firebase reports', async () => {
    // The SDK's free onAuthStateChanged(auth, observer) delegates to the
    // Auth instance's own onAuthStateChanged, so faking that method is enough.
    const user = { email: 'alice@example.com', emailVerified: true },
      fakeAuth = {
        onAuthStateChanged: (observer: { next: (u: unknown) => void }) => {
          observer.next(user);
          return () => undefined;
        },
      };

    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_AUTH, useValue: fakeAuth }],
    });

    const service = TestBed.inject(AuthService),
      emitted = await firstValueFrom(service.hasUser());
    expect(emitted?.email).toBe('alice@example.com');
  });
});

// Firebase keeps the ID token it issued before verification (email_verified
// false) for up to an hour, and the API trusts only the token.
describe('AuthService verification helpers', () => {
  const build = (user: unknown) => {
    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_AUTH, useValue: { currentUser: user } }],
    });
    return TestBed.inject(AuthService);
  };

  const fakeUser = (opts: { verifiedAfterReload: boolean; tokenSaysVerified: boolean }) => {
    const user: any = {
      emailVerified: false,
      reload: vi.fn(async () => {
        user.emailVerified = opts.verifiedAfterReload;
      }),
      getIdTokenResult: vi.fn(async () => ({ claims: { email_verified: opts.tokenSaysVerified } })),
      getIdToken: vi.fn(async () => 'fresh-token'),
    };
    return user;
  };

  it('refreshVerification sees a verification made in another tab and refreshes the stale token', async () => {
    const user = fakeUser({ verifiedAfterReload: true, tokenSaysVerified: false });

    expect(await build(user).refreshVerification()).toBe(true);
    expect(user.reload).toHaveBeenCalled();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });

  it('refreshVerification reports a still-unverified user and leaves the token alone', async () => {
    const user = fakeUser({ verifiedAfterReload: false, tokenSaysVerified: false });

    expect(await build(user).refreshVerification()).toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it('refreshVerification is false when nobody is signed in', async () => {
    expect(await build(null).refreshVerification()).toBe(false);
  });

  it('ensureVerifiedToken leaves a token that already says verified alone', async () => {
    const user = fakeUser({ verifiedAfterReload: true, tokenSaysVerified: true });
    user.emailVerified = true;

    await build(user).ensureVerifiedToken();

    expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it('ensureVerifiedToken does nothing for an unverified user', async () => {
    const user = fakeUser({ verifiedAfterReload: false, tokenSaysVerified: false });

    await build(user).ensureVerifiedToken();

    expect(user.getIdTokenResult).not.toHaveBeenCalled();
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});
