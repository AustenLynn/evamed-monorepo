import { TestBed } from '@angular/core/testing';

import { ImpactLevel } from '../../explorer.models';
import { ExplorerModule } from '../../explorer.module';
import { ImpactBadgeComponent } from './impact-badge.component';

describe('ImpactBadgeComponent', () => {
  const render = (level: ImpactLevel) => {
    TestBed.configureTestingModule({ imports: [ExplorerModule] });
    const fixture = TestBed.createComponent(ImpactBadgeComponent);
    fixture.componentRef.setInput('level', level);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it.each([
    ['bajo', 'Bajo impacto', 1],
    ['medio', 'Impacto medio', 2],
    ['alto', 'Alto impacto', 3],
  ] as const)('shows %s with its label and %i filled dots', (level, label, filled) => {
    const el = render(level);

    expect(el.textContent?.trim()).toBe(label);
    expect(el.querySelectorAll('.impact-badge__dot').length).toBe(3);
    expect(el.querySelectorAll('.impact-badge__dot--on').length).toBe(filled);
    expect(el.querySelector('.impact-badge__gauge')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a credit with the recycling icon and no dots', () => {
    const el = render('credito');

    expect(el.textContent).toContain('Crédito ambiental');
    expect(el.querySelectorAll('.impact-badge__dot').length).toBe(0);
  });

  it('shows nothing without a level', () => {
    expect(render(null).querySelector('.impact-badge')).toBeNull();
  });
});
