import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { RecoverEmailActionComponent } from './recover-email-action.component';

describe('RecoverEmailActionComponent', () => {
  const failing = (code: string) => async () => { throw Object.assign(new Error(code), { code }); };

  const setup = (overrides: Record<string, unknown> = {}) => {
    const auth = {
      checkActionCode: vi.fn(async () => ({ email: 'ana@example.com' })),
      applyActionCode: vi.fn(async () => undefined),
      resetPassword: vi.fn(async () => undefined),
      ...overrides,
    };
    const snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }, { provide: MatSnackBar, useValue: snackBar }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RecoverEmailActionComponent);
    fixture.componentRef.setInput('oobCode', 'code-123');
    fixture.detectChanges();
    return { fixture, auth, snackBar, navigate, el: fixture.nativeElement as HTMLElement };
  };

  const settle = async (fixture: ComponentFixture<unknown>) => {
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
  };

  it('restores the email and says which one', async () => {
    const { fixture, auth, el } = setup();
    await settle(fixture);

    expect(auth.checkActionCode).toHaveBeenCalledWith('code-123');
    expect(auth.applyActionCode).toHaveBeenCalledWith('code-123');
    expect(el.textContent).toContain('Restauramos tu correo');
    expect(el.textContent).toContain('ana@example.com');
  });

  it('sends a password reset to the restored email', async () => {
    const { fixture, auth, snackBar, el } = setup();
    await settle(fixture);

    (el.querySelector('.action-reset') as HTMLButtonElement).click();
    await settle(fixture);

    expect(auth.resetPassword).toHaveBeenCalledWith('ana@example.com');
    expect(snackBar.open).toHaveBeenCalledWith('Te enviamos un correo para restablecer tu contraseña.', 'OK', { duration: 4000 });
  });

  it('reports a reset email that could not be sent', async () => {
    const { fixture, snackBar, el } = setup({ resetPassword: vi.fn(failing('auth/too-many-requests')) });
    await settle(fixture);

    (el.querySelector('.action-reset') as HTMLButtonElement).click();
    await settle(fixture);

    expect(snackBar.open).toHaveBeenCalledWith('No se pudo enviar el correo. Intenta nuevamente.', 'OK', { duration: 4000 });
  });

  it('offers sign-in for a spent link', async () => {
    const { fixture, navigate, el } = setup({ checkActionCode: vi.fn(failing('auth/invalid-action-code')) });
    await settle(fixture);

    expect(el.textContent).toContain('Este enlace ya no es válido.');
    (el.querySelector('.action-login') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('lets the user retry when Firebase cannot be reached', async () => {
    const checkActionCode = vi.fn()
      .mockImplementationOnce(failing('auth/network-request-failed'))
      .mockResolvedValue({ email: 'ana@example.com' });
    const { fixture, el } = setup({ checkActionCode });
    await settle(fixture);

    (el.querySelector('.action-retry') as HTMLButtonElement).click();
    await settle(fixture);

    expect(checkActionCode).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Restauramos tu correo');
  });
});
