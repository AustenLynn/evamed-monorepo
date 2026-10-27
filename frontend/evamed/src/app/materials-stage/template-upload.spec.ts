// Compile the page in its NgModule's context.
import './materials-stage.module';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { bySection } from '../shared/template-sheets';

// EVAMED_WINDOWS.xlsm has no hidden first sheet, and the page used to skip one
// for every file: Cimentación showed Muros interiores, Otros showed "Inicio".
describe('Materiales page with a Windows template', () => {
  it('shows each section its own systems', () => {
    const component: any = Object.create(MaterialsStageComponent.prototype),
      names = ['Cimentación', 'Muros Interiores', 'Muros exteriores', 'Pisos', 'Techos', 'Entrepiso', 'Estructura',
        'Puertas', 'Ventanas', 'Inst. especiales', 'Otros', 'Inicio', 'Registro', 'ListaElementos', 'BD', 'Parametros'],
      upload = bySection({
        sheetNames: names,
        data: names.map(name => [{ Origen: 'Modelo de Revit', Sistema_constructivo: `Sistema ${name}`, Material: 'x', Cantidad: 1 }]),
      });
    component.sheetNames = upload.sheetNames;
    component.contentData = upload.data;
    component.clearMaterialsPanel = vi.fn();
    component.syncSelectionsForCurrentSheet = vi.fn();

    const shown = (sheet: string) => {
      component.onGroupsChange([{ value: sheet }]);
      return component.ListSCRevit;
    };

    expect(shown('Cimentación')).toEqual(['Sistema Cimentación']);
    expect(shown('Muros interiores')).toEqual(['Sistema Muros Interiores']);
    expect(shown('Inst. especiales')).toEqual(['Sistema Inst. especiales']);
    expect(shown('Otros')).toEqual(['Sistema Otros']);
  });

  // An upload stored before rows went by sheet name still has the Mac file's
  // 17 sheet names; written back, the rows must stay with their sections.
  it('stores the section names with the rows it writes back', () => {
    const component: any = Object.create(MaterialsStageComponent.prototype),
      names = ['Muros InterioresBis', 'Cimentación', 'Muros interiores'],
      cimentacion = [{ Origen: 'Modelo de Revit', Sistema_constructivo: 'Zapata', Material: 'x', Cantidad: 1 }];
    sessionStorage.setItem('dataProject', JSON.stringify({ sheetNames: names, data: [[], cimentacion, []] }));
    const upload = bySection(JSON.parse(sessionStorage.getItem('dataProject')!));
    component.sheetNames = upload.sheetNames;
    component.contentData = upload.data;
    component.indexSheet = 0;
    component.listData = [...cimentacion, { ...cimentacion[0], Sistema_constructivo: 'Losa' }];

    component.storeSheet();

    const reloaded = bySection(JSON.parse(sessionStorage.getItem('dataProject')!));
    expect(reloaded.data[0].map(row => row['Sistema_constructivo'])).toEqual(['Zapata', 'Losa']);
    sessionStorage.clear();
  });
});
