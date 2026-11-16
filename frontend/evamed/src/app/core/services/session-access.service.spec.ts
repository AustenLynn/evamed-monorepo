import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { FIREBASE_AUTH } from '../firebase';
import { CatalogueCacheService } from './catalogue-cache/catalogue-cache.service';
import { UserService } from './user/user.service';
import { SessionAccessService, RESET_ACCESS_VIEW } from './session-access.service';

describe('SessionAccessService', () => {
  let service: SessionAccessService, auth: any, users: any, cache: any, reset: any;
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear();
    window.history.replaceState({}, '', '/home-evamed');
    auth = {
      currentUser: { uid: 'a', email: 'ana@correo.uia.mx', emailVerified: true },
      onIdTokenChanged: vi.fn(callback => { auth.observer = callback; return vi.fn(); }),
    };
    users = { getMe: vi.fn(() => of({ can_access_ecoplatform: true })) };
    cache = { clear: vi.fn() }; reset = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: FIREBASE_AUTH, useValue: auth },
      { provide: UserService, useValue: users },
      { provide: CatalogueCacheService, useValue: cache },
      { provide: RESET_ACCESS_VIEW, useValue: reset },
    ] });
    service = TestBed.inject(SessionAccessService);
  });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

  it('uses backend capability, clears cached project state on loss and restores access', async () => {
    await service.refresh();
    expect(service.canAccessEcoplatform()).toBe(true);
    sessionStorage.setItem('primaryDataProject', 'secret');
    localStorage.setItem('idProyectoConstrucción', '7');
    users.getMe.mockReturnValue(of({ can_access_ecoplatform: false }));
    await service.refresh();
    expect(service.canAccessEcoplatform()).toBe(false);
    expect(sessionStorage.getItem('primaryDataProject')).toBeNull();
    expect(localStorage.getItem('idProyectoConstrucción')).toBeNull();
    expect(cache.clear).toHaveBeenCalled();
    expect(reset).toHaveBeenCalledOnce();
    users.getMe.mockReturnValue(of({ can_access_ecoplatform: true }));
    await service.refresh();
    expect(service.canAccessEcoplatform()).toBe(true);
  });

  it('fails closed when /me is unavailable or capability is absent', async () => {
    users.getMe.mockReturnValue(throwError(() => new Error('offline')));
    await service.refresh();
    expect(service.canAccessEcoplatform()).toBe(false);
    users.getMe.mockReturnValue(of({}));
    await service.refresh();
    expect(service.canAccessEcoplatform()).toBe(false);
  });

  it('clears state when accounts switch even when both have access', async () => {
    await service.refresh();
    sessionStorage.setItem('dataProject', 'secret');
    auth.currentUser = { uid: 'b', email: 'bob@correo.uia.mx', emailVerified: true };
    await service.refresh();
    expect(sessionStorage.getItem('dataProject')).toBeNull();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('ignores a late capability response from the previous account', async () => {
    const pending = new Subject<any>();
    users.getMe.mockReturnValue(pending);
    const first = service.refresh();
    auth.currentUser = null;
    await service.refresh();
    pending.next({ can_access_ecoplatform: true }); pending.complete();
    await first;
    expect(service.canAccessEcoplatform()).toBe(false);
  });
  it('records an account switch before navigation so reload cannot repeat it', async () => {
    await service.refresh();
    auth.currentUser = { uid: 'b', email: 'bob@example.com', emailVerified: true };
    const pending = new Subject<any>();
    users.getMe.mockReturnValue(pending);
    const refresh = service.refresh();
    expect(sessionStorage.getItem('evamed-access-identity')).toContain('bob@example.com');
    expect(reset).toHaveBeenCalledOnce();
    pending.next({ can_access_ecoplatform: false }); pending.complete();
    await refresh;
  });

  it.each(['/auth/register', '/auth/login', '/auth/complete-profile', '/auth/verify-email'])(
    'does not interrupt provisioning or verification on %s', async path => {
      window.history.replaceState({}, '', path);
      auth.currentUser = null;
      await service.refresh();
      service.start();
      sessionStorage.setItem('primaryDataProject', 'old account');
      auth.currentUser = { uid: 'new', email: 'new@correo.uia.mx', emailVerified: false };
      const pending = new Subject<any>();
      users.getMe.mockReturnValue(pending);
      auth.observer();
      expect(sessionStorage.getItem('primaryDataProject')).toBeNull();
      expect(reset).not.toHaveBeenCalled();
      pending.next({ can_access_ecoplatform: false }); pending.complete();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(reset).not.toHaveBeenCalled();
    }
  );

});
