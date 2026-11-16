import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from './../../../environments/environment';
import { FIREBASE_AUTH } from './../firebase';
import { SessionAccessService } from '../services/session-access.service';
import { AuthInterceptor } from './auth.interceptor';

// A stand-in for Firebase Auth: a signed-in user whose token we can assert on.
const fakeAuth = {
  currentUser: { getIdToken: () => Promise.resolve('test-token') },
  authStateReady: () => Promise.resolve(),
};

describe('AuthInterceptor', () => {
  const denyProject = vi.fn();
  let http: HttpClient,
    httpMock: HttpTestingController;

  beforeEach(() => {
    denyProject.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: FIREBASE_AUTH, useValue: fakeAuth },
        { provide: SessionAccessService, useValue: { denyProject } },
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
    const foreign = 'https://api.example.com/api-projects/projects/';
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
  it('clears the active project on a rejected direct project or stage request', async () => {
    for (const url of [environment.api_projects + '7/', environment.api_projects.replace(/projects\/$/, 'materials-stage/') + '?project_id=7']) {
      http.get(url).subscribe({ error: () => {} });
      await new Promise(resolve => setTimeout(resolve, 0));
      httpMock.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
    }
    expect(denyProject).toHaveBeenCalledTimes(2);
  });

  it('does not clear project state for a missing catalogue material', async () => {
    const url = environment.api_materials + '999/';
    http.get(url).subscribe({ error: () => {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    httpMock.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
    expect(denyProject).not.toHaveBeenCalled();
  });

});
