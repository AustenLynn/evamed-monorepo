import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from './../../../environments/environment';
import { FIREBASE_AUTH } from './../firebase';
import { AuthInterceptor } from './auth.interceptor';

// A stand-in for Firebase Auth: a signed-in user whose token we can assert on.
const fakeAuth = {
  currentUser: { getIdToken: () => Promise.resolve('test-token') },
  authStateReady: () => Promise.resolve(),
};

describe('AuthInterceptor', () => {
  let http: HttpClient,
    httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: FIREBASE_AUTH, useValue: fakeAuth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the Firebase token to our API', async () => {
    http.get(environment.api_projects).subscribe();
    await new Promise(resolve => setTimeout(resolve, 0));
    const request = httpMock.expectOne(environment.api_projects);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([]);
  });

  it('does not attach it to another host', async () => {
    const foreign = 'https://evamed-rest-api.herokuapp.com/api-projects/material-scheme-data/';
    http.get(foreign).subscribe();
    await new Promise(resolve => setTimeout(resolve, 0));
    const request = httpMock.expectOne(foreign);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('does not attach it to a same-origin path outside the API', async () => {
    http.get('/assets/images/logo.png').subscribe();
    await new Promise(resolve => setTimeout(resolve, 0));
    const request = httpMock.expectOne('/assets/images/logo.png');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
