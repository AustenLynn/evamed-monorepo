import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';

import { AdminGuard } from './admin.guard';
// Compile LayoutComponent (referenced by the app routes) in its NgModule's context.
import './app.module';
import { AppRoutingModule } from './app-routing.module';
import { AuthService } from './core/services/auth.service';

// AdminGuard protects every platform route (not only admin pages): the user
// must be signed in and have verified their email.
describe('AdminGuard', () => {
  const run = (user: unknown, overrides: Record<string, unknown> = {}, url?: string) => {
    const auth = {
      hasUser: () => of(user),
      refreshVerification: vi.fn(async () => false),
      ensureVerifiedToken: vi.fn(async () => undefined),
      ...overrides,
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const result = TestBed.inject(AdminGuard).canActivate(
      null as any,
      (url ? { url } : null) as any
    ) as Observable<boolean | UrlTree>;
    return { auth, outcome: firstValueFrom(result) };
  };
  const target = (outcome: boolean | UrlTree) =>
    outcome instanceof UrlTree ? TestBed.inject(Router).serializeUrl(outcome) : outcome;

  it('sends a signed-out visitor to the login page', async () => {
    expect(target(await run(null).outcome)).toBe('/auth/login');
  });

  it('lets a verified user in and makes sure their token says so', async () => {
    const { auth, outcome } = run({ emailVerified: true });

    expect(await outcome).toBe(true);
    expect(auth.ensureVerifiedToken).toHaveBeenCalled();
  });

  it('sends an unverified user to the verify page', async () => {
    expect(target(await run({ emailVerified: false }).outcome)).toBe('/auth/verify-email');
  });

  it('lets in a user who has just verified in another tab', async () => {
    const { outcome } = run({ emailVerified: false }, { refreshVerification: vi.fn(async () => true) });

    expect(await outcome).toBe(true);
  });

  it('sends the user to the verify page when the check itself fails (offline)', async () => {
    const { outcome } = run(
      { emailVerified: false },
      { refreshVerification: vi.fn(async () => { throw new Error('auth/network-request-failed'); }) }
    );

    expect(target(await outcome)).toBe('/auth/verify-email');
  });

  it('still lets a verified user in when the token refresh fails', async () => {
    const { outcome } = run(
      { emailVerified: true },
      { ensureVerifiedToken: vi.fn(async () => { throw new Error('auth/network-request-failed'); }) }
    );

    expect(await outcome).toBe(true);
  });
  it('remembers the requested page when it sends a user to verify', async () => {
    const { outcome } = run({ emailVerified: false }, {}, '/resultados');

    expect(target(await outcome)).toBe('/auth/verify-email?returnUrl=%2Fresultados');
  });
  const never = <T>() => new Promise<T>(() => undefined);

  it('sends an unverified user to the verify page when Firebase never answers', async () => {
    vi.useFakeTimers();
    try {
      const { outcome } = run({ emailVerified: false }, { refreshVerification: vi.fn(() => never<boolean>()) });
      let settled = false;
      outcome.then(() => (settled = true));

      await vi.advanceTimersByTimeAsync(4_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(target(await outcome)).toBe('/auth/verify-email');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a verified user in when the token refresh never answers', async () => {
    vi.useFakeTimers();
    try {
      const { outcome } = run({ emailVerified: true }, { ensureVerifiedToken: vi.fn(() => never<void>()) });

      await vi.advanceTimersByTimeAsync(5_000);

      expect(await outcome).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a Firebase answer that arrives after the timeout', async () => {
    vi.useFakeTimers();
    try {
      let late: (verified: boolean) => void = () => undefined;
      const { outcome } = run(
        { emailVerified: false },
        { refreshVerification: vi.fn(() => new Promise<boolean>(resolve => (late = resolve))) }
      );

      await vi.advanceTimersByTimeAsync(5_000);
      late(true);
      await vi.advanceTimersByTimeAsync(0);

      expect(target(await outcome)).toBe('/auth/verify-email');
    } finally {
      vi.useRealTimers();
    }
  });
});

// Social users finish /auth/complete-profile before verifying, and the verify
// page itself lives under /auth: that branch must never be guarded.
describe('app routes', () => {
  it('leave /auth unguarded', () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule] });
    const auth = TestBed.inject(Router).config.find(route => route.path === 'auth');

    expect(auth).toBeDefined();
    expect(auth?.canActivate ?? []).toEqual([]);
  });
});
