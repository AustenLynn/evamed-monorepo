import { of } from 'rxjs';

// Compile the pages in their NgModules' context.
import '../home-evamed/home-evamed.module';
import '../materials-stage/materials-stage.module';
import { HomeEvamedComponent } from '../home-evamed/components/home-evamed/home-evamed.component';
import { MaterialsStageComponent } from '../materials-stage/components/materials-stage/materials-stage.component';

// A click outside a window now closes it (R-48), with no result, as Esc already did.
describe('Windows closed without an answer', () => {
  it('renaming a project changes nothing', () => {
    const component: any = Object.create(HomeEvamedComponent.prototype);
    component.dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
    component.projectsService = { getProjectById: vi.fn(), updateProyect: vi.fn() };

    component.renameProject(7);

    expect(component.projectsService.getProjectById).not.toHaveBeenCalled();
  });

  it('adding a building element adds nothing', () => {
    const component: any = Object.create(MaterialsStageComponent.prototype);
    component.dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
    component.sheetNames = ['Muros'];
    component.contentData = [[]];

    component.addConstructiveElementsDialog();

    expect(component.sheetNames).toEqual(['Muros']);
    expect(component.contentData).toEqual([[]]);
  });
});
