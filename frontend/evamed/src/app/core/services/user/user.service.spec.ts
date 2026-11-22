import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from './../../../../environments/environment';
import { UserService } from './user.service';

describe('UserService.getMe', () => {
  let service: UserService,
    httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads the admin flag from the configured /me endpoint', () => {
    let isAdmin: boolean | undefined;
    service.getMe().subscribe(me => (isAdmin = me.is_admin));

    const request = httpMock.expectOne(environment.api_me);
    expect(request.request.method).toBe('GET');
    request.flush({ email: 'boss@example.com', is_admin: true, email_verified: true });

    expect(isAdmin).toBe(true);
  });

  it('shares one request between simultaneous callers and asks again afterwards (audit A-03)', () => {
    const seen: boolean[] = [];
    service.getMe().subscribe(me => seen.push(me.is_admin));
    service.getMe().subscribe(me => seen.push(me.is_admin));
    httpMock.expectOne(environment.api_me).flush({ is_admin: false });
    expect(seen).toEqual([false, false]);

    service.getMe().subscribe(me => seen.push(me.is_admin));
    httpMock.expectOne(environment.api_me).flush({ is_admin: true });
    expect(seen).toEqual([false, false, true]);
  });
});
