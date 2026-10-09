import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CatalogueCacheService } from './catalogue-cache.service';

describe('CatalogueCacheService', () => {
  let cache: CatalogueCacheService,
    http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    cache = TestBed.inject(CatalogueCacheService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('makes one request for simultaneous and later callers', () => {
    const seen: any[] = [];
    cache.get('/c/').subscribe(v => seen.push(v));
    cache.get('/c/').subscribe(v => seen.push(v));
    http.expectOne('/c/').flush([1]);
    cache.get('/c/').subscribe(v => seen.push(v));

    expect(seen).toEqual([[1], [1], [1]]);
  });

  it('refetches after invalidate', () => {
    cache.get('/c/').subscribe();
    http.expectOne('/c/').flush([1]);
    cache.invalidate('/c/');

    let value: any;
    cache.get('/c/').subscribe(v => (value = v));
    http.expectOne('/c/').flush([2]);
    expect(value).toEqual([2]);
  });

  it('passes an error on and retries on the next call', () => {
    let failed = false;
    cache.get('/c/').subscribe({ error: () => (failed = true) });
    http.expectOne('/c/').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(failed).toBe(true);

    let value: any;
    cache.get('/c/').subscribe(v => (value = v));
    http.expectOne('/c/').flush([3]);
    expect(value).toEqual([3]);
  });
});
