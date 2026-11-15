import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { UsageService } from './usage.service';

describe('Usage aggregate transport', () => {
  it('scopes saves and reconciliation to the intended project, retaining operation identity', () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    const api = TestBed.inject(UsageService), http = TestBed.inject(HttpTestingController),
      request = {revision: 'before', operation_id: 'request-id', annual: {quantity: 12000}};
    api.save(5, request).subscribe();
    const save = http.expectOne(`${environment.api_projects}5/usage/`);
    expect(save.request.method).toBe('PUT'); expect(save.request.body).toEqual(request); save.flush({});
    api.load(5, 'request-id').subscribe();
    const load = http.expectOne(`${environment.api_projects}5/usage/?operation_id=request-id`);
    expect(load.request.method).toBe('GET'); load.flush({}); http.verify();
  });
});
