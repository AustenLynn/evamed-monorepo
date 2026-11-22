import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { UserService } from './core/services/user/user.service';
import { IsAdminGuard } from './is-admin.guard';

// Audit A-19 (2026-11-22): any signed-in user could open the admin pages.
describe('IsAdminGuard', () => {
  const run = (getMe: () => any) => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UserService, useValue: { getMe } }],
    });
    return firstValueFrom(TestBed.inject(IsAdminGuard).canActivate());
  };

  it('lets administrators in', async () => {
    expect(await run(() => of({ is_admin: true }))).toBe(true);
  });

  it('sends everyone else home, also when the check fails', async () => {
    for (const getMe of [() => of({ is_admin: false }), () => throwError(() => new Error('offline'))]) {
      TestBed.resetTestingModule();
      const result = await run(getMe);
      expect(result instanceof UrlTree).toBe(true);
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home-evamed');
    }
  });
});
