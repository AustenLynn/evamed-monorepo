// Compile each stage component in its NgModule's context.
import './construction-stage/construction-stage.module';
import './end-life-stage/end-life-stage.module';
import './materials-stage/materials-stage.module';
import './usage-stage/usage-stage.module';

import { ConstructionStageComponent } from './construction-stage/components/construction-stage/construction-stage.component';
import { EndLifeStageComponent } from './end-life-stage/components/end-life-stage/end-life-stage.component';
import { MaterialsStageComponent } from './materials-stage/components/materials-stage/materials-stage.component';
import { UsageStageComponent } from './usage-stage/components/usage-stage/usage-stage.component';

// While a new project is filled in, the stage pages know it as this.projectId
// (from primaryDataProject). "Ir a resultados" must open that project, not
// whatever localStorage['idProyectoConstrucción'] last pointed at.
describe.each([
  ['materials', MaterialsStageComponent],
  ['construction', ConstructionStageComponent],
  ['usage', UsageStageComponent],
  ['end of life', EndLifeStageComponent],
])('%s stage "Ir a resultados"', (_name, stage: any) => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('opens the results of the project being filled in', () => {
    localStorage.setItem('idProyectoConstrucción', '3'); // an earlier project
    // Skip the constructor: it starts a dozen requests this test doesn't need.
    const component = Object.create(stage.prototype),
      navigateByUrl = vi.fn();
    component.projectId = 42;
    component.router = { navigateByUrl };

    component.goToResultados();

    expect(sessionStorage.getItem('projectID')).toBe('42');
    expect(navigateByUrl).toHaveBeenCalledWith('resultados');
  });
});
