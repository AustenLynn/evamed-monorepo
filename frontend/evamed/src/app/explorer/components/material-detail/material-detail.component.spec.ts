import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ExplorerUiModule } from '../../explorer-ui.module';
import { DETAIL } from '../../testing';
import { MaterialDetailComponent } from './material-detail.component';


describe('MaterialDetailComponent', () => {
  let http: HttpTestingController;

  const render = (canSelect = false) => {
    TestBed.configureTestingModule({
      imports: [ExplorerUiModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MaterialDetailComponent);
    fixture.componentRef.setInput('materialId', 12);
    fixture.componentRef.setInput('canSelect', canSelect);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('loads the material and shows its sections', () => {
    const { fixture, el } = render();
    expect(el.textContent).toContain('Cargando material…');

    http.expectOne(request => request.url.endsWith('/explorer/produccion/12/')).flush(DETAIL);
    fixture.detectChanges();

    expect(el.querySelector('h1')?.textContent?.trim()).toBe('AAC block');
    expect(el.querySelector('.detail__description')?.textContent).toContain('Bloque de concreto celular');
    expect(el.querySelector('.detail__facts')?.textContent).toContain('1234 · versión 3.12');
    const rows = Array.from(el.querySelectorAll('.detail__table tbody tr')).map(row =>
      Array.from(row.children).map(cell => cell.textContent?.trim())
    );
    expect(rows[0]).toEqual(['Potencial de calentamiento global (PCG 100)', 'kg CO2 eq', '—', '—', '—', '0.4']);
    expect(rows[1][2]).toBe('0.001');
    expect(rows[1][3]).toBe('2 × 10⁻⁴');
  });

  it('compares the material with its category on one scale', () => {
    const { fixture, el } = render();
    http.expectOne(() => true).flush(DETAIL);
    fixture.detectChanges();

    const bars = Array.from(el.querySelectorAll<HTMLElement>('.detail__bar-row'));
    expect(bars.map(bar => bar.querySelector('.detail__bar-label')?.textContent?.trim())).toEqual([
      'Este material',
      'Promedio de 8 materiales',
      'Mejor 25 %',
    ]);
    expect(bars.map(bar => bar.querySelector<HTMLElement>('.detail__bar')!.style.width)).toEqual(['50%', '100%', '62.5%']);
  });

  it('hides the comparison when the group is too small', () => {
    const { fixture, el } = render();
    http.expectOne(() => true).flush({ ...DETAIL, comparison: null });
    fixture.detectChanges();

    expect(el.querySelector('.detail__bars')).toBeNull();
  });

  it('offers "Seleccionar recurso" only when picking, and emits the material', () => {
    const browse = render();
    http.expectOne(() => true).flush(DETAIL);
    browse.fixture.detectChanges();
    expect(browse.el.querySelector('.detail__select')).toBeNull();
    TestBed.resetTestingModule();

    const { fixture, el } = render(true),
      selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    http.expectOne(() => true).flush(DETAIL);
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.detail__select')!.click();

    expect(selected).toHaveBeenCalledWith(DETAIL);
  });

  it('says when the material is gone, and retries other failures', () => {
    const { fixture, el } = render();
    http.expectOne(() => true).flush('', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('No se pudo cargar el material.');

    el.querySelector<HTMLButtonElement>('[role=alert] button')!.click();
    http.expectOne(() => true).flush('', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Este material ya no está en el catálogo.');
  });
});
