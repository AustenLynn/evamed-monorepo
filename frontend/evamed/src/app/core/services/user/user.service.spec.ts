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
});
