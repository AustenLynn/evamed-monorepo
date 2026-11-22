import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { requiresProject } from './requires-project.guard';

// Audit A-26 (2026-11-22): /materials-stage/update with no active project asked for
// /projects/null/ and showed an empty page.
describe('requiresProject', () => {
  const run = (guard: ReturnType<typeof requiresProject>) =>
    TestBed.runInInjectionContext(() => guard({} as any, {} as any));

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('lets the page open when a project is active', () => {
    localStorage.setItem('idProyectoConstrucción', '651');
    sessionStorage.setItem('projectID', '12');
    expect(run(requiresProject('stage'))).toBe(true);
    expect(run(requiresProject('results'))).toBe(true);
  });

  it('sends the user home when there is none, or it is junk', () => {
    for (const value of [null, 'null', 'NaN', '0', 'abc']) {
      if (value === null) localStorage.removeItem('idProyectoConstrucción');
      else localStorage.setItem('idProyectoConstrucción', value);
      const result = run(requiresProject('stage'));
      expect(result instanceof UrlTree).toBe(true);
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home-evamed');
    }
    expect(run(requiresProject('results')) instanceof UrlTree).toBe(true);
  });
});
