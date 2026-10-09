import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { VerifyEmailComponent } from './verify-email.component';

describe('VerifyEmailComponent', () => {
  const unverified = { email: 'ana@example.com', emailVerified: false };

  const setup = (user: unknown, overrides: Record<string, unknown> = {}) => {
    const auth = {
      hasUser: () => of(user),
      refreshVerification: vi.fn(async () => false),
      resendVerification: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      ...overrides,
    };
    const snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    return { fixture, auth, snackBar, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  const click = async (el: HTMLElement, selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    await settle();
  };

  it('tells the user where the link was sent', () => {
    const { el } = setup(unverified);

    expect(el.textContent).toContain('Verifica tu correo electrónico');
    expect(el.textContent).toContain('ana@example.com');
  });

  it('sends a signed-out visitor to the login page', () => {
    const { navigate } = setup(null);

    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('sends an already verified user into the platform', () => {
    const { navigate } = setup({ email: 'ana@example.com', emailVerified: true });

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('continues into the platform once the check confirms the verification', async () => {
    const { el, navigate } = setup(unverified, { refreshVerification: vi.fn(async () => true) });

    await click(el, 'button.yellow-button-login');

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('says so and stays when the email is not verified yet', async () => {
    const { el, fixture, navigate } = setup(unverified);

    await click(el, 'button.yellow-button-login');
    fixture.detectChanges();

    expect(el.querySelector('.verify-pending')?.textContent).toContain('Aún no vemos la verificación');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a check that fails (offline) instead of breaking', async () => {
    const { el, snackBar, navigate } = setup(unverified, {
      refreshVerification: vi.fn(async () => { throw new Error('auth/network-request-failed'); }),
    });

    await click(el, 'button.yellow-button-login');

    expect(snackBar.open).toHaveBeenCalledWith(
      'No pudimos comprobar la verificación. Intenta nuevamente.', 'OK', { duration: 4000 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('runs one check at a time however often the button is pressed', async () => {
    let finish: (verified: boolean) => void = () => undefined;
    const refreshVerification = vi.fn(() => new Promise<boolean>(resolve => (finish = resolve)));
    const { fixture } = setup(unverified, { refreshVerification });

    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();
    finish(false);
    await settle();

    expect(refreshVerification).toHaveBeenCalledTimes(1);
  });

  // Clicking the button in an unfocused window fires window:focus first, which
  // starts a silent check; the click must still get its answer.
  it('reports the outcome to a click that arrives during a focus re-check', async () => {
    let finish: (verified: boolean) => void = () => undefined;
    const refreshVerification = vi.fn(() => new Promise<boolean>(resolve => (finish = resolve)));
    const { fixture, el } = setup(unverified, { refreshVerification });

    window.dispatchEvent(new Event('focus'));
    fixture.componentInstance.confirm();
    finish(false);
    await settle();
    fixture.detectChanges();

    expect(refreshVerification).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.verify-pending')).not.toBeNull();
  });

  it('re-checks when the tab regains focus', async () => {
    const { navigate } = setup(unverified, { refreshVerification: vi.fn(async () => true) });

    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('resends the email and confirms it', async () => {
    const { el, auth, snackBar } = setup(unverified);

    await click(el, '.verify-resend');

    expect(auth.resendVerification).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      'Te enviamos un nuevo correo de verificación.', 'OK', { duration: 4000 });
  });

  it('reports a failed resend (e.g. too many requests)', async () => {
    const { el, snackBar } = setup(unverified, {
      resendVerification: vi.fn(async () => { throw new Error('auth/too-many-requests'); }),
    });

    await click(el, '.verify-resend');

    expect(snackBar.open).toHaveBeenCalledWith(
      'No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
  });

  it('signs out back to the login page', async () => {
    const { el, auth, navigate } = setup(unverified);

    await click(el, '.verify-logout');

    expect(auth.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });
  it('offers its actions as real buttons', () => {
    const { el } = setup(unverified);

    for (const selector of ['.verify-resend', '.verify-logout', '.verify-about']) {
      const action = el.querySelector(selector);
      expect(action?.tagName, selector).toBe('BUTTON');
      expect(action?.getAttribute('type'), selector).toBe('button');
    }
  });

  it('does not sign out when a letter is typed on the sign-out action', async () => {
    const { el, auth } = setup(unverified);

    el.querySelector('.verify-logout')!.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true }));
    await settle();

    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('keeps the natural tab order (no positive tabindex)', () => {
    const { el } = setup(unverified);

    const positive = Array.from(el.querySelectorAll('[tabindex]')).filter(
      element => Number(element.getAttribute('tabindex')) > 0
    );
    expect(positive).toEqual([]);
  });
});
