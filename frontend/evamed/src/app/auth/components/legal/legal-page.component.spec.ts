import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { LegalPageComponent } from './legal-page.component';

describe('Legal pages (audit A-23)', () => {
  const render = (documento: string) => {
    TestBed.configureTestingModule({
      imports: [LegalPageComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { data: { documento } } } }],
    });
    const fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the privacy notice, marked as a draft', () => {
    const el = render('privacidad');
    expect(el.querySelector('h1')?.textContent).toBe('Aviso de privacidad');
    expect(el.querySelector('.legal__borrador')).toBeTruthy();
    expect(el.textContent).toContain('ARCO');
  });

  it('shows the terms', () => {
    expect(render('terminos').querySelector('h1')?.textContent).toBe('Términos y condiciones');
  });
});
