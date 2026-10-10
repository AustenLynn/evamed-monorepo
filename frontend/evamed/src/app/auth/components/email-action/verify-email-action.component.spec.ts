import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { VerifyEmailActionComponent } from './verify-email-action.component';

describe('VerifyEmailActionComponent', () => {
  const signedIn = { email: 'ana@example.com' };
  const spent = Object.assign(new Error('spent'), { code: 'auth/invalid-action-code' });

  const setup = (overrides: Record<string, unknown> = {}, user: unknown = signedIn) => {
    const auth = {
      hasUser: () => of(user),
      applyActionCode: vi.fn(async () => undefined),
      refreshVerification: vi.fn(async () => true),
      ...overrides,
    };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailActionComponent);
    fixture.componentRef.setInput('oobCode', 'code-123');
    fixture.detectChanges();
    return { fixture, auth, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = async (fixture: { detectChanges(): void }) => {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  };

  it('confirms the email with the code from the link', async () => {
    const { fixture, auth } = setup();
    await settle(fixture);

    expect(auth.applyActionCode).toHaveBeenCalledWith('code-123');
  });

  it('takes a signed-in user into the platform 2 s after verifying', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, auth, navigate, el } = setup();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      expect(el.textContent).toContain('¡Correo verificado!');
      expect(auth.refreshVerification).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_000);
      expect(navigate).toHaveBeenCalledWith(['/']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('enters at once with Entrar ahora, and only once', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, navigate, el } = setup();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      (el.querySelector('.action-enter') as HTMLButtonElement).click();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not navigate after the page is left', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, navigate } = setup();
      await vi.advanceTimersByTimeAsync(0);

      fixture.destroy();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(navigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not navigate when the page is left while the token is still refreshing', async () => {
    vi.useFakeTimers();
    try {
      let finishRefresh: (verified: boolean) => void = () => undefined;
      const { fixture, navigate } = setup({
        refreshVerification: vi.fn(() => new Promise<boolean>(resolve => (finishRefresh = resolve))),
      });
      await vi.advanceTimersByTimeAsync(0);

      fixture.destroy();
      finishRefresh(true);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(navigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not enter when the page is left while a spent link is being checked', async () => {
    let finishRefresh: (verified: boolean) => void = () => undefined;
    const spentLink = Object.assign(new Error('spent'), { code: 'auth/invalid-action-code' });
    const { fixture, navigate } = setup({
      applyActionCode: vi.fn(async () => { throw spentLink; }),
      refreshVerification: vi.fn(() => new Promise<boolean>(resolve => (finishRefresh = resolve))),
    });
    await settle(fixture);

    fixture.destroy();
    finishRefresh(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('waits for a saved session to be restored before deciding', async () => {
    const user$ = new Subject<unknown>();
    const { fixture, auth, el } = setup({ hasUser: () => user$ });
    await settle(fixture);
    expect(auth.applyActionCode).not.toHaveBeenCalled();

    user$.next(signedIn);
    await settle(fixture);

    expect(el.querySelector('.action-enter')).not.toBeNull();
  });

  it('offers sign-in when nobody is signed in here', async () => {
    const { fixture, auth, navigate, el } = setup({}, null);
    await settle(fixture);

    expect(el.textContent).toContain('¡Correo verificado!');
    expect(auth.refreshVerification).not.toHaveBeenCalled();
    (el.querySelector('.action-login') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('goes straight in when an already verified user reopens a used link', async () => {
    const { fixture, navigate } = setup({ applyActionCode: vi.fn(async () => { throw spent; }) });
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('offers a new verification email when the link is spent and the user is still unverified', async () => {
    const { fixture, navigate, el } = setup({
      applyActionCode: vi.fn(async () => { throw spent; }),
      refreshVerification: vi.fn(async () => false),
    });
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace ya no es válido.');
    (el.querySelector('.action-resend') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/verify-email']);
  });

  it('offers sign-in for a spent link when nobody is signed in', async () => {
    const expired = Object.assign(new Error('expired'), { code: 'auth/expired-action-code' });
    const { fixture, el } = setup({ applyActionCode: vi.fn(async () => { throw expired; }) }, null);
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace ya no es válido.');
    expect(el.querySelector('.action-login')).not.toBeNull();
  });

  it('lets the user retry when Firebase cannot be reached', async () => {
    const offline = Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
    const applyActionCode = vi.fn().mockRejectedValueOnce(offline).mockResolvedValue(undefined);
    const { fixture, el } = setup({ applyActionCode }, null);
    await settle(fixture);
    expect(el.textContent).toContain('No pudimos completar la acción. Intenta nuevamente.');

    (el.querySelector('.action-retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(applyActionCode).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('¡Correo verificado!');
  });
});
