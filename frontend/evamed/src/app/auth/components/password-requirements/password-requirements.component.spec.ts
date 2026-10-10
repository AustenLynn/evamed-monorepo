import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from 'src/app/core/services/auth.service';
import { AuthModule } from '../../auth.module';
import { PasswordRequirementsComponent, toRequirements } from './password-requirements.component';

const policy = {
  customStrengthOptions: {
    minPasswordLength: 12,
    containsUppercaseLetter: true,
    containsLowercaseLetter: true,
    containsNumericCharacter: true,
  },
  allowedNonAlphanumericCharacters: '',
  enforcementState: 'ENFORCE',
};

const status = (overrides: Record<string, unknown> = {}): any => ({
  isValid: false,
  meetsMinPasswordLength: false,
  containsUppercaseLetter: false,
  containsLowercaseLetter: true,
  containsNumericCharacter: false,
  passwordPolicy: policy,
  ...overrides,
});

const allMet = { isValid: true, meetsMinPasswordLength: true, containsUppercaseLetter: true, containsNumericCharacter: true };

describe('toRequirements', () => {
  it("lists each rule the policy requires, with Firebase's minimum length", () => {
    expect(toRequirements(status())).toEqual([
      { label: 'Al menos 12 caracteres', met: false },
      { label: 'Una letra mayúscula', met: false },
      { label: 'Una letra minúscula', met: true },
      { label: 'Un número', met: false },
    ]);
  });

  it('leaves out rules the policy does not require', () => {
    const labels = toRequirements(status({ containsUppercaseLetter: undefined, containsNumericCharacter: undefined }))
      .map(requirement => requirement.label);

    expect(labels).toEqual(['Al menos 12 caracteres', 'Una letra minúscula']);
  });
});

describe('PasswordRequirementsComponent', () => {
  const setup = (checkPassword: (password: string) => Promise<unknown>) => {
    TestBed.configureTestingModule({
      imports: [AuthModule],
      providers: [{ provide: AuthService, useValue: { checkPassword } }],
    });
    const fixture = TestBed.createComponent(PasswordRequirementsComponent);
    const emitted: (boolean | null)[] = [];
    fixture.componentInstance.validityChange.subscribe(valid => emitted.push(valid));
    return { fixture, emitted };
  };

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  const type = async (fixture: ComponentFixture<PasswordRequirementsComponent>, password: string) => {
    fixture.componentRef.setInput('password', password);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  };

  const items = (fixture: ComponentFixture<PasswordRequirementsComponent>) =>
    Array.from(fixture.nativeElement.querySelectorAll('.requirement')) as HTMLElement[];

  it('ticks the rules a password meets and reports whether it is valid', async () => {
    const { fixture, emitted } = setup(vi.fn(async () => status(allMet)));

    await type(fixture, 'Correcta12345');

    expect(items(fixture).map(item => item.classList.contains('met'))).toEqual([true, true, true, true]);
    expect(emitted.at(-1)).toBe(true);
  });

  it('shows the latest password even when answers arrive out of order', async () => {
    let stale: (answer: unknown) => void = () => undefined;
    const checkPassword = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => (stale = resolve)))
      .mockImplementationOnce(async () => status(allMet));
    const { fixture, emitted } = setup(checkPassword);

    await type(fixture, 'cor');
    await type(fixture, 'Correcta12345');
    stale(status());
    await settle();
    fixture.detectChanges();

    expect(emitted).toEqual([true]);
    expect(items(fixture).every(item => item.classList.contains('met'))).toBe(true);
  });

  it('falls back to the rules as plain text when the policy cannot be fetched', async () => {
    const { fixture, emitted } = setup(vi.fn(async () => { throw new Error('auth/network-request-failed'); }));

    await type(fixture, 'algo');

    expect(items(fixture).map(item => item.querySelector('.label')?.textContent?.trim())).toEqual([
      'Al menos 12 caracteres', 'Una letra mayúscula', 'Una letra minúscula', 'Un número',
    ]);
    expect(items(fixture).some(item => item.classList.contains('met') || item.classList.contains('unmet'))).toBe(false);
    expect(emitted.at(-1)).toBeNull();
  });
});
