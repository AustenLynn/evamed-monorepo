import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { usageFixture } from '../testing/usage-fixtures';
import { UsageApiService } from './usage-api.service';

describe('Usage aggregate transport', () => {
  let api: UsageApiService, http: HttpTestingController;
  beforeEach(() => {TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]}); api = TestBed.inject(UsageApiService); http = TestBed.inject(HttpTestingController);});
  afterEach(() => http.verify());
  it('reloads uncached canonical state and includes operation identity only for reconciliation', () => {
    api.load(5).subscribe(); const first = http.expectOne(`${environment.api_projects}5/usage/`); expect(first.request.method).toBe('GET'); first.flush(usageFixture());
    api.load(5, 'frozen-uuid').subscribe(); const recovery = http.expectOne(request => request.url === `${environment.api_projects}5/usage/` && request.params.get('operation_id') === 'frozen-uuid'); recovery.flush({...usageFixture(), operation_applied: true});
    api.load(5).subscribe(); const fresh = http.expectOne(`${environment.api_projects}5/usage/`); expect(fresh.request.params.has('operation_id')).toBe(false); fresh.flush(usageFixture());
  });
  it('sends an isolated operation to the project-scoped PUT endpoint', () => {
    const request = {revision: 'saved-1', operation_id: 'uuid', edits: [{id: 21, percentage: 30}]};
    api.save(5, request).subscribe(); const save = http.expectOne(`${environment.api_projects}5/usage/`); expect(save.request.method).toBe('PUT'); expect(save.request.body).toEqual(request); save.flush(usageFixture());
  });
});
