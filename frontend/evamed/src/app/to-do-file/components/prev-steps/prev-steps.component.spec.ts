import { of } from 'rxjs';

// Compile the component in its NgModule's context.
import '../../to-do-file.module';
import { PrevStepsComponent } from './prev-steps.component';

// The import summary counts the uploaded file's distinct construction systems
// and materials, and splits the materials into those found in the database
// catalogue and those that aren't. Empty cells come through as ''.
describe('PrevStepsComponent import summary', () => {
  afterEach(() => sessionStorage.clear());

  it('counts distinct non-blank values and splits materials by the catalogue', () => {
    sessionStorage.setItem(
      'dataProject',
      JSON.stringify({
        sheetNames: ['Muros', 'Pisos', 'BD'],
        data: [
          [
            { Sistema_constructivo: 'Muro A', Material: 'Concreto' },
            { Sistema_constructivo: 'Muro A', Material: 'Acero' },
            { Sistema_constructivo: '', Material: '' },
          ],
          [
            { Sistema_constructivo: 'Losa', Material: 'Concreto' },
            { Sistema_constructivo: '  ', Material: 'Madera' },
          ],
          [{ Nombre: 'catálogo de la plantilla' }],
        ],
      })
    );
    const getMaterials = vi.fn(() =>
        of([{ name_material: 'Concreto' }, { name_material: 'Acero' }, { name_material: 'Concreto' }])
      ),
      component = new PrevStepsComponent({ getMaterials } as any, {} as any, {} as any);

    component.ngOnInit();

    expect(component.ConstructiveSystems).toBe(2);
    expect(component.identifiedMaterials).toBe(2);
    expect(component.unidentifiedMaterials).toBe(1);
    expect(getMaterials).toHaveBeenCalledTimes(1);
  });

  it('shows zero systems for an empty template', () => {
    sessionStorage.setItem(
      'dataProject',
      JSON.stringify({ sheetNames: ['Muros'], data: [[{ Sistema_constructivo: null, Material: '' }]] })
    );
    const component = new PrevStepsComponent({ getMaterials: () => of([]) } as any, {} as any, {} as any);

    component.ngOnInit();

    expect(component.ConstructiveSystems).toBe(0);
    expect(component.identifiedMaterials).toBe(0);
    expect(component.unidentifiedMaterials).toBe(0);
  });
});
