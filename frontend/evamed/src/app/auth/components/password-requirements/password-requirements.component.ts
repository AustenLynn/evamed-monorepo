import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { PasswordValidationStatus } from 'firebase/auth';

import { AuthService } from 'src/app/core/services/auth.service';

export interface Requirement {
  label: string;
  // null: unknown (the policy couldn't be fetched).
  met: boolean | null;
}

// Shown when Firebase can't be reached; Firebase still enforces the policy on submit.
const FALLBACK: Requirement[] = [
  { label: 'Al menos 12 caracteres', met: null },
  { label: 'Una letra mayúscula', met: null },
  { label: 'Una letra minúscula', met: null },
  { label: 'Un número', met: null },
];

// One line per rule the Firebase policy requires (undefined = not required).
export function toRequirements(status: PasswordValidationStatus): Requirement[] {
  const min = status.passwordPolicy?.customStrengthOptions?.minPasswordLength ?? 6;
  const rules: [boolean | undefined, string][] = [
    [status.meetsMinPasswordLength, `Al menos ${min} caracteres`],
    [status.containsUppercaseLetter, 'Una letra mayúscula'],
    [status.containsLowercaseLetter, 'Una letra minúscula'],
    [status.containsNumericCharacter, 'Un número'],
    [status.containsNonAlphanumericCharacter, 'Un símbolo'],
  ];
  return rules.filter(([met]) => met !== undefined).map(([met, label]) => ({ label, met: met as boolean }));
}

@Component({
  selector: 'app-password-requirements',
  templateUrl: './password-requirements.component.html',
  styleUrls: ['./password-requirements.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PasswordRequirementsComponent implements OnChanges {
  @Input() password = '';
  // The password meets the policy; null when the policy couldn't be fetched.
  @Output() validityChange = new EventEmitter<boolean | null>();
  items: Requirement[] = FALLBACK;
  private latest = 0;

  constructor(private authService: AuthService) {}

  ngOnChanges(): void {
    this.check(this.password ?? '');
  }

  private async check(password: string): Promise<void> {
    // Answers can arrive out of order while the user types; keep the newest.
    const request = ++this.latest;
    try {
      const status = await this.authService.checkPassword(password);
      if (request !== this.latest) {
        return;
      }
      this.items = toRequirements(status);
      this.validityChange.emit(status.isValid);
    } catch {
      if (request !== this.latest) {
        return;
      }
      this.items = FALLBACK;
      this.validityChange.emit(null);
    }
  }
}
