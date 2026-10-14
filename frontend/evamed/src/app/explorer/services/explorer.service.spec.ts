import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ExplorerService } from './explorer.service';

describe('ExplorerService', () => {
  let service: ExplorerService, http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExplorerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for one page of 24 with the search and every chosen value', () => {
    service.page('produccion', { search: '  concreto ', filters: { source: ['EPiC', 'EPDs'] } }, 2).subscribe();

    const request = http.expectOne(() => true);
    expect(request.request.url).toBe(`${environment.api_explorer}produccion/`);
    expect(request.request.params.toString()).toBe('page=2&page_size=24&search=concreto&source=EPiC&source=EPDs');
  });

  it('leaves out an empty search', () => {
    service.page('uso', { search: ' ', filters: {} }, 1).subscribe();

    expect(http.expectOne(() => true).request.params.has('search')).toBe(false);
  });

  it('keeps one feed per stage and query, whatever the filter order', () => {
    const first = service.feed('produccion', { search: 'a', filters: { source: ['EPiC', 'EPDs'], type: [] } });

    expect(service.feed('produccion', { search: 'a', filters: { source: ['EPDs', 'EPiC'] } })).toBe(first);
    expect(service.feed('uso', { search: 'a', filters: { source: ['EPDs', 'EPiC'] } })).not.toBe(first);
    expect(service.feed('produccion', { search: 'b', filters: {} })).not.toBe(first);
  });

  it('asks for one material', () => {
    service.material(12).subscribe();

    expect(http.expectOne(() => true).request.url).toBe(`${environment.api_explorer}produccion/12/`);
  });
});
