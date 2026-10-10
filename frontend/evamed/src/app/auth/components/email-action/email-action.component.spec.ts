import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router, RouterModule, ROUTES } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthRoutingModule } from '../../auth-routing.module';
import { AuthModule } from '../../auth.module';
import { EmailActionComponent } from './email-action.component';

describe('EmailActionComponent', () => {
  const never = () => new Promise<never>(() => undefined);

  const setup = (params: Record<string, string>) => {
    const auth = {
      hasUser: () => of(null),
      applyActionCode: vi.fn(never),
      checkActionCode: vi.fn(never),
      verifyPasswordResetCode: vi.fn(never),
      checkPassword: vi.fn(never),
    };
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EmailActionComponent);
    fixture.detectChanges();
    return { navigate, el: fixture.nativeElement as HTMLElement };
  };

  it.each([
    ['verifyEmail', 'app-verify-email-action'],
    ['resetPassword', 'app-reset-password-action'],
    ['recoverEmail', 'app-recover-email-action'],
  ])('shows the handler for mode=%s', (mode, selector) => {
    const { el } = setup({ mode, oobCode: 'code-123' });

    expect(el.querySelector(selector)).not.toBeNull();
    expect(el.querySelector('.action-invalid')).toBeNull();
  });

  it.each([
    [{ mode: 'verifyEmail' }],
    [{ oobCode: 'code-123' }],
    [{ mode: 'signIn', oobCode: 'code-123' }],
  ])('says the link is not valid for %o', params => {
    const { el } = setup(params);

    expect(el.querySelector('.action-invalid')?.textContent).toContain('Este enlace ya no es válido.');
  });

  it('offers sign-in from an invalid link', () => {
    const { el, navigate } = setup({});

    (el.querySelector('.action-login') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});

// Firebase's email links must reach this page signed out or unverified.
describe('auth routes', () => {
  it('serve the email action page at /auth/action, unguarded', () => {
    TestBed.configureTestingModule({ imports: [RouterModule.forRoot([]), AuthRoutingModule] });

    const route = TestBed.inject(ROUTES).flat().find(candidate => candidate.path === 'action');

    expect(route?.component).toBe(EmailActionComponent);
    expect(route?.canActivate ?? []).toEqual([]);
  });
});
