import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ExplorerItem } from '../../explorer.models';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { ResultCardComponent } from './result-card.component';

describe('ResultCardComponent', () => {
  const item: ExplorerItem = {
      id: 12,
      stage: 'produccion',
      name: 'Concreto_AAC block',
      display_name: 'AAC block',
      category: 'Concreto',
      description: 'Bloque de concreto celular',
      source: 'EPiC',
      unit: 'Pz',
      gwp: 12.3456,
      impact_level: 'bajo',
    },
    render = (inputs: Partial<{ item: ExplorerItem; link: unknown[] | null }> = {}) => {
      TestBed.configureTestingModule({ imports: [ExplorerUiModule], providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(ResultCardComponent);
      fixture.componentRef.setInput('item', inputs.item ?? item);
      if (inputs.link !== undefined) {
        fixture.componentRef.setInput('link', inputs.link);
      }
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement };
    };

  it('shows the name, description, GWP per unit, impact and database', () => {
    const { el } = render();

    expect(el.querySelector('.result-card__name')?.textContent?.trim()).toBe('AAC block');
    expect(el.querySelector('.result-card__description')?.textContent?.trim()).toBe('Bloque de concreto celular');
    expect(el.querySelector('.result-card__gwp')?.textContent?.trim()).toBe('12.346');
    expect(el.querySelector('.result-card__unit')?.textContent?.trim()).toBe('kg CO₂e / Pz');
    expect(el.querySelector('app-impact-badge')?.textContent).toContain('Bajo impacto');
    expect(el.querySelector('app-source-chip img')?.getAttribute('src')).toBe('assets/logos/EPIC.png');
  });

  it('says "por unidad de referencia" when the data has no unit (R-04)', () => {
    const { el } = render({ item: { ...item, unit: null, impact_level: null } });

    expect(el.querySelector('.result-card__unit')?.textContent?.trim()).toBe('kg CO₂e por unidad de referencia');
    expect(el.querySelector('.impact-badge')).toBeNull();
  });

  it('links the name only when given a link', () => {
    expect(render().el.querySelector('.result-card__name a')).toBeNull();
    TestBed.resetTestingModule();

    const link = render({ link: ['/explorador', 'produccion', 12] }).el.querySelector('.result-card__name a');
    expect(link?.getAttribute('href')).toBe('/explorador/produccion/12');
  });

  it('shows a negative value as a green credit with a true minus', () => {
    const { el } = render({ item: { ...item, gwp: -1.5, impact_level: 'credito' } }),
      gwp = el.querySelector('.result-card__gwp')!;

    expect(gwp.textContent?.trim()).toBe('−1.5');
    expect(gwp.classList).toContain('result-card__gwp--credit');
  });
});
