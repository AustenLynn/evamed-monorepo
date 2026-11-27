import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { CatalogueDetail } from '../../explorer.models';
import { CatalogueDetailComponent } from './catalogue-detail.component';

const EXCAVATOR: CatalogueDetail = {
  id: 11, stage: 'construccion', name: 'Excavadora hidráulica (GLO)', display_name: 'Excavadora hidráulica',
  source: null, region: 'Global', type: 'Otros', unit: 'm³', gwp: 0.3218, description: null, modules: 'A5 y C1',
  ecoinvent: {dataset_id: 3302, version: '3.12-sandbox', activity: 'market for excavation, hydraulic digger', geography: 'GLO'},
  indicators: [
    {code: 'GWP-total', name: 'Calentamiento global, total', unit: 'kg CO2 eq', value: 0.3218},
    {code: 'AP', name: 'Acidificación', unit: 'mol H+ eq', value: 0.0023},
  ],
};

describe('CatalogueDetailComponent', () => {
  let http: HttpTestingController;
  const render = (actionLabel = 'Agregar a la selección') => {
    TestBed.configureTestingModule({imports: [ExplorerUiModule], providers: [provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CatalogueDetailComponent), back = vi.fn(), action = vi.fn();
    fixture.componentRef.setInput('stage', 'construccion'); fixture.componentRef.setInput('itemId', 11);
    fixture.componentRef.setInput('actionLabel', actionLabel);
    fixture.componentInstance.back.subscribe(back); fixture.componentInstance.action.subscribe(action);
    fixture.detectChanges();
    return {fixture, el: fixture.nativeElement as HTMLElement, back, action};
  };
  afterEach(() => http.verify());

  it('shows what is stored about an equipment, per unit', () => {
    const {fixture, el} = render();
    expect(el.textContent).toContain('Cargando');
    http.expectOne(`${environment.api_explorer}construccion/11/`).flush(EXCAVATOR); fixture.detectChanges();
    expect(el.querySelector('h1')!.textContent!.trim()).toBe('Excavadora hidráulica');
    expect(el.textContent).toContain('Sin descripción.');
    expect(el.textContent).toContain('A5 y C1');
    expect(el.textContent).toContain('market for excavation, hydraulic digger');
    expect(el.textContent).toContain('GLO');
    expect(el.textContent).toContain('kg CO₂e / m³');
    const rows = [...el.querySelectorAll('tbody tr')].map(row => row.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('Acidificación');
    expect(rows[1]).toContain('mol H+ eq');
  });

  it('says so when nothing is stored for the current method', () => {
    const {fixture, el} = render();
    http.expectOne(`${environment.api_explorer}construccion/11/`).flush({...EXCAVATOR, indicators: [], gwp: null, ecoinvent: null});
    fixture.detectChanges();
    expect(el.textContent).toContain('Sin valores del método de cálculo actual.');
  });

  it('retries after an error', () => {
    const {fixture, el} = render();
    http.expectOne(`${environment.api_explorer}construccion/11/`).flush('x', {status: 500, statusText: 'Error'}); fixture.detectChanges();
    expect(el.textContent).toContain('No se pudo cargar la ficha.');
    el.querySelector<HTMLButtonElement>('[data-retry]')!.click(); fixture.detectChanges();
    http.expectOne(`${environment.api_explorer}construccion/11/`).flush(EXCAVATOR); fixture.detectChanges();
    expect(el.querySelector('h1')).toBeTruthy();
  });

  it('goes back and acts', () => {
    const {fixture, el, back, action} = render('Quitar de la selección');
    http.expectOne(`${environment.api_explorer}construccion/11/`).flush(EXCAVATOR); fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-back]')!.click();
    const button = el.querySelector<HTMLButtonElement>('[data-action]')!;
    expect(button.textContent!.trim()).toBe('Quitar de la selección');
    button.click();
    expect(back).toHaveBeenCalledTimes(1); expect(action).toHaveBeenCalledTimes(1);
  });
});
