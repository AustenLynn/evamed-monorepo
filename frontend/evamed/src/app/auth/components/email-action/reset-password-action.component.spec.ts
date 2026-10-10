import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { ResetPasswordActionComponent } from './reset-password-action.component';

describe('ResetPasswordActionComponent', () => {
  const valid = { isValid: true, meetsMinPasswordLength: true, passwordPolicy: { customStrengthOptions: { minPasswordLength: 12 } } };
  const invalid = { isValid: false, meetsMinPasswordLength: false, passwordPolicy: { customStrengthOptions: { minPasswordLength: 12 } } };
  const failing = (code: string) => async () => { throw Object.assign(new Error(code), { code }); };

  const setup = (overrides: Record<string, unknown> = {}) => {
    const auth = {
      verifyPasswordResetCode: vi.fn(async () => 'ana@example.com'),
      confirmPasswordReset: vi.fn(async () => undefined),
      login: vi.fn(async () => ({})),
      checkPassword: vi.fn(async () => valid),
      ...overrides,
    };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ResetPasswordActionComponent);
    fixture.componentRef.setInput('oobCode', 'code-123');
    fixture.detectChanges();
    return { fixture, auth, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = async (fixture: ComponentFixture<unknown>) => {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
  };

  const fill = async (fixture: ComponentFixture<ResetPasswordActionComponent>, password: string, password2 = password) => {
    fixture.componentInstance.form.setValue({ password, password2 });
    fixture.detectChanges();
    await settle(fixture);
  };

  beforeEach(() => localStorage.removeItem('email-login'));
  afterEach(() => localStorage.removeItem('email-login'));

  it("shows the form for the link's account", async () => {
    const { fixture, auth, el } = setup();
    await settle(fixture);

    expect(auth.verifyPasswordResetCode).toHaveBeenCalledWith('code-123');
    expect(el.textContent).toContain('ana@example.com');
    expect(el.querySelector('app-password-requirements')).not.toBeNull();
  });

  it('saves, signs in with the new password and enters the platform', async () => {
    const { fixture, auth, navigate } = setup();
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();

    expect(auth.confirmPasswordReset).toHaveBeenCalledWith('code-123', 'NuevaClave123');
    expect(auth.login).toHaveBeenCalledWith('ana@example.com', 'NuevaClave123');
    expect(localStorage.getItem('email-login')).toBe('ana@example.com');
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('does not save when the passwords differ', async () => {
    const { fixture, auth, el } = setup();
    await settle(fixture);
    await fill(fixture, 'NuevaClave123', 'OtraClave123');

    await fixture.componentInstance.save();

    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
    expect(el.querySelector('.reset-mismatch')?.textContent).toContain('Las contraseñas no coinciden');
  });

  it('does not save while the password misses the policy', async () => {
    const { fixture, auth, el } = setup({ checkPassword: vi.fn(async () => invalid) });
    await settle(fixture);
    await fill(fixture, 'corta');

    await fixture.componentInstance.save();

    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
    expect((el.querySelector('.action-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves once however often Guardar is pressed', async () => {
    const confirmPasswordReset = vi.fn(() => new Promise<void>(() => undefined));
    const { fixture } = setup({ confirmPasswordReset });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    fixture.componentInstance.save();
    fixture.componentInstance.save();

    expect(confirmPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('says the password was updated when the automatic sign-in fails', async () => {
    const { fixture, navigate, el } = setup({ login: vi.fn(failing('auth/network-request-failed')) });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();
    await settle(fixture);

    expect(el.textContent).toContain('Contraseña actualizada');
    (el.querySelector('.action-login') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('explains a password Firebase rejects and keeps it', async () => {
    const { fixture, el } = setup({ confirmPasswordReset: vi.fn(failing('auth/password-does-not-meet-requirements')) });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();
    await settle(fixture);

    expect(el.querySelector('.reset-password-error')?.textContent).toContain('La contraseña no cumple los requisitos.');
    expect(fixture.componentInstance.form.value.password).toBe('NuevaClave123');
  });

  it('keeps the form and says so when saving fails', async () => {
    const { fixture, el } = setup({ confirmPasswordReset: vi.fn(failing('auth/network-request-failed')) });
    await settle(fixture);
    await fill(fixture, 'NuevaClave123');

    await fixture.componentInstance.save();
    await settle(fixture);

    expect(el.querySelector('.reset-save-error')?.textContent).toContain('No se pudo guardar. Intenta nuevamente.');
    expect(el.querySelector('.action-save')).not.toBeNull();
  });

  it('offers a new link when this one is spent', async () => {
    const { fixture, navigate, el } = setup({ verifyPasswordResetCode: vi.fn(failing('auth/expired-action-code')) });
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace para restablecer la contraseña ya no es válido.');
    (el.querySelector('.action-request') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/recover-password']);
  });

  it('lets the user retry when Firebase cannot be reached', async () => {
    const verifyPasswordResetCode = vi.fn()
      .mockImplementationOnce(failing('auth/network-request-failed'))
      .mockResolvedValue('ana@example.com');
    const { fixture, el } = setup({ verifyPasswordResetCode });
    await settle(fixture);

    (el.querySelector('.action-retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(verifyPasswordResetCode).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('ana@example.com');
  });
});
