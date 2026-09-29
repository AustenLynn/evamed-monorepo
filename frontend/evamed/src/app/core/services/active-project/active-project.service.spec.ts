import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProjectsService } from '../projects/projects.service';
import { ActiveProjectService } from './active-project.service';

// The stage pages identify the project from localStorage['idProyectoConstrucción']
// and sessionStorage['primaryDataProject'], and the new-project pages also read
// the imported Excel from sessionStorage['dataProject']. Opening an existing
// project has to leave all three describing that project.
describe('ActiveProjectService.open', () => {
  let getProjectById: ReturnType<typeof vi.fn>,
    service: ActiveProjectService;

  beforeEach(() => {
    // Left over from creating another project earlier in this tab.
    sessionStorage.setItem('primaryDataProject', JSON.stringify({ id: 3, name_project: 'Otro' }));
    sessionStorage.setItem('dataProject', JSON.stringify({ sheetNames: ['Otro'], data: [] }));
    localStorage.setItem('idProyectoConstrucción', '3');

    getProjectById = vi.fn(() => of({ id: 7, name_project: 'Casa Norte' }));
    TestBed.configureTestingModule({
      providers: [{ provide: ProjectsService, useValue: { getProjectById } }],
    });
    service = TestBed.inject(ActiveProjectService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('makes the opened project the one every stage page sees', () => {
    let done = false;
    service.open(7).subscribe(() => (done = true));

    expect(done).toBe(true);
    expect(getProjectById).toHaveBeenCalledWith('7');
    expect(localStorage.getItem('idProyectoConstrucción')).toBe('7');
    expect(JSON.parse(sessionStorage.getItem('primaryDataProject'))).toEqual({ id: 7, name_project: 'Casa Norte' });
    expect(sessionStorage.getItem('dataProject')).toBeNull();
  });

  it('never leaves another project behind when the project cannot be fetched', () => {
    getProjectById.mockReturnValue(throwError(() => new Error('offline')));
    let done = false;
    service.open(7).subscribe(() => (done = true));

    expect(done).toBe(true);
    expect(localStorage.getItem('idProyectoConstrucción')).toBe('7');
    expect(sessionStorage.getItem('primaryDataProject')).toBeNull();
    expect(sessionStorage.getItem('dataProject')).toBeNull();
  });
});
