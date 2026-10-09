import { of } from 'rxjs';

// Compile the component in its NgModule's context.
import '../../auth.module';
import { RegisterComponent } from './register.component';

describe('RegisterComponent sign-up', () => {
  it('sends the new user to the verify-email page, not to login', async () => {
    // Skip the constructor: it builds the form and loads the country catalogue.
    const component: any = Object.create(RegisterComponent.prototype);
    component.form = {
      valid: true,
      value: {
        name: 'Ana', email: 'ana@example.com', institution: 'Ibero', sector: 'Academia',
        country: 1, password: 'secreto123', password2: 'secreto123',
      },
    };
    component.authService = {
      createUser: vi.fn(async () => ({})),
      verifyEmail: vi.fn(async () => undefined),
      deleteCurrentUser: vi.fn(async () => undefined),
    };
    component.user = { addUser: vi.fn(() => of({})) };
    component.snackBar = { open: vi.fn() };
    component.router = { navigate: vi.fn() };

    component.register(new Event('submit'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.authService.verifyEmail).toHaveBeenCalled();
    expect(component.router.navigate).toHaveBeenCalledWith(['/auth/verify-email']);
  });

  // The platform finds the user's profile by this key (home-evamed logs out
  // and sends to /auth/register when it finds none). Login and social sign-in
  // set it; sign-up no longer passes through login, so it must set it too.
  it('remembers the new user for the platform, as login does', async () => {
    localStorage.removeItem('email-login');
    const component: any = Object.create(RegisterComponent.prototype);
    component.form = {
      valid: true,
      value: {
        name: 'Ana', email: 'ana@example.com', institution: 'Ibero', sector: 'Academia',
        country: 1, password: 'secreto123', password2: 'secreto123',
      },
    };
    component.authService = {
      createUser: vi.fn(async () => ({})),
      verifyEmail: vi.fn(async () => undefined),
      deleteCurrentUser: vi.fn(async () => undefined),
    };
    component.user = { addUser: vi.fn(() => of({})) };
    component.snackBar = { open: vi.fn() };
    component.router = { navigate: vi.fn() };

    component.register(new Event('submit'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(localStorage.getItem('email-login')).toBe('ana@example.com');
    localStorage.removeItem('email-login');
  });
});
