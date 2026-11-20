import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MaterialsService } from './materials.service';

describe('MaterialsService.getPotentialTypes', () => {
  it('asks for every method, because only admin screens use it', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(MaterialsService).getPotentialTypes().subscribe();
    const request = http.expectOne(req => req.url.includes('potential-types'));
    expect(request.request.params.get('method')).toBe('all');
    request.flush([]);
    http.verify();
  });
});
