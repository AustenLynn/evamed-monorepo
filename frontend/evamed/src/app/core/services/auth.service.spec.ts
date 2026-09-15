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
