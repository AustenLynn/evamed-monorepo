import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ProjectSavesService } from '../services/energy-total/project-saves.service';
import { ProjectSavesInterceptor } from './project-saves.interceptor';

// Any confirmed change to project data refreshes the stage pages' carbon bar.
describe('ProjectSavesInterceptor', () => {
  const run = (method: string, url: string, ok = true) => {
    const saves = new ProjectSavesService(),
      notify = vi.spyOn(saves, 'notify'),
      next = { handle: () => (ok ? of(new HttpResponse({ status: 200 })) : throwError(() => new Error('400'))) };
    new ProjectSavesInterceptor(saves).intercept(new HttpRequest(method as any, url, null), next as any)
      .subscribe({ error: () => undefined });
    return notify.mock.calls.length;
  };

  it('signals after a successful write to the projects API', () => {
    expect(run('POST', '/api-projects/material-scheme-project/')).toBe(1);
    expect(run('PATCH', '/api-projects/usage/42/')).toBe(1);
    expect(run('DELETE', '/api-projects/constructive-system-element/7/')).toBe(1);
  });

  it('ignores reads, failures and other APIs', () => {
    expect(run('GET', '/api-projects/projects/42/results/')).toBe(0);
    expect(run('POST', '/api-projects/material-scheme-project/', false)).toBe(0);
    expect(run('POST', '/api-users/profile/')).toBe(0);
  });
});
