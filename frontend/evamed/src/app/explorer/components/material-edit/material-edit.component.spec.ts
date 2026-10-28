import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CatalogsService } from '../../../core/services/catalogs/catalogs.service';
import { ExplorerUiModule } from '../../explorer-ui.module';
import { PickedMaterial } from '../../picker.models';
import { DETAIL } from '../../testing';
import { cleanTransport, MaterialEditComponent } from './material-edit.component';

describe('MaterialEditComponent', () => {
  const transports = [
      { id: 1, name_transport: 'Transporte por oceano, Buque carguero (GLO)-Ecoinvent 3' },
      { id: 4, name_transport: 'Vehículo de carga, mayor a 32 Ton, tipo EURO 3 (RoW)-Ecoinvent 3' },
    ],
    render = (context: object = { system: 'Muro de block', section: 'Muros exteriores', projectLife: 50 }) => {
      TestBed.configureTestingModule({
        imports: [ExplorerUiModule],
        providers: [{ provide: CatalogsService, useValue: { getTransports: () => of(transports) } }],
      });
      const fixture = TestBed.createComponent(MaterialEditComponent),
        saved: PickedMaterial[] = [];
      fixture.componentRef.setInput('detail', DETAIL);
      fixture.componentRef.setInput('context', context);
      fixture.componentInstance.save.subscribe(value => saved.push(value));
      fixture.detectChanges();
      const component = fixture.componentInstance,
        el = fixture.nativeElement as HTMLElement,
        submit = () => {
          el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
          fixture.detectChanges();
        };
      return { fixture, component, el, saved, submit };
    };

  it('starts from the catalogue name, the project life and the calculation defaults', () => {
    const { component } = render();

    expect(component.form.getRawValue()).toEqual({
      comercialName: 'AAC block',
      quantity: 0,
      comments: '',
      transportOrigin: 1,
      distanceOrigin: null,
      transportEnd: 4,
      distanceEnd: null,
      lifeYears: 50,
      replaces: 0,
    });
  });

  it('adds a new material at quantity 0, to be filled in later, as several added at once are', () => {
    const { component, saved, submit, el } = render();

    submit();
    expect(saved[0].quantity).toBe(0);

    component.form.patchValue({ quantity: null });
    submit();
    expect(saved[1].quantity).toBe(0);

    component.form.patchValue({ quantity: -1 });
    submit();
    expect(saved.length).toBe(2);
    expect(el.textContent).toContain('La cantidad no puede ser negativa.');
  });

  it('editing a project row still needs a quantity above zero', () => {
    const { component, saved, submit, el } = render({
      mode: 'edit', system: 'Muro de block', projectLife: 50, materialId: 12,
      initial: {
        comercialName: 'Block', quantity: null, comments: '', transportOrigin: null, distanceOrigin: null,
        transportEnd: 4, distanceEnd: null, replaces: 0, rowUnit: null,
      },
    });

    submit();
    expect(saved).toEqual([]);
    expect(el.textContent).toContain('La cantidad debe ser mayor que 0.');

    component.form.patchValue({ quantity: 0 });
    submit();
    expect(saved).toEqual([]);
  });

  it('needs a transport type for a distance', () => {
    const { component, saved, submit, el } = render();
    component.form.patchValue({ quantity: 10, transportEnd: null, distanceEnd: 120 });

    submit();

    expect(saved).toEqual([]);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Elige el tipo de transporte para esta distancia.');
  });

  it('rejects negative distances', () => {
    const { component, saved, submit } = render();
    component.form.patchValue({ quantity: 10, distanceOrigin: -5 });

    submit();

    expect(saved).toEqual([]);
  });

  it('keeps life and replacements in step, both ways', () => {
    const { component, el, fixture } = render(),
      life = el.querySelector<HTMLInputElement>('input[formcontrolname=lifeYears]')!,
      replaces = el.querySelector<HTMLInputElement>('input[formcontrolname=replaces]')!;

    life.value = '20';
    life.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.form.controls.replaces.value).toBe(2); // ceil(50 / 20) − 1

    replaces.value = '4';
    replaces.dispatchEvent(new Event('input'));
    expect(component.form.controls.lifeYears.value).toBe(10);
  });

  it('emits the material with what was entered', () => {
    const { component, saved, submit } = render();
    component.form.patchValue({
      comercialName: ' Block celular ',
      quantity: 12.5,
      comments: 'Muro norte',
      distanceOrigin: 1200,
      distanceEnd: null,
      lifeYears: 25,
      replaces: 1,
    });

    submit();

    expect(saved).toEqual([
      {
        material: { id: 12, name: 'Concreto_AAC block', unit: 'kg', source: 'ECOINVENT 3' },
        comercialName: 'Block celular',
        quantity: 12.5,
        comments: 'Muro norte',
        transportOrigin: 1,
        distanceOrigin: 1200,
        transportEnd: 4,
        distanceEnd: null,
        lifeYears: 25,
        replaces: 1,
      },
    ]);
  });

  it('shows the declared unit read-only', () => {
    const { el } = render(),
      unit = Array.from(el.querySelectorAll<HTMLInputElement>('input[readonly]'));

    expect(unit.map(input => input.value)).toEqual(['kg']);
  });

  it('cleans transport names for display', () => {
    expect(cleanTransport('Vehículo de carga, entre  16 y 32 Ton, tipo EURO 3 (RoW)-Ecoinvent 3')).toBe(
      'Vehículo de carga, entre 16 y 32 Ton, tipo EURO 3 (RoW)'
    );
  });
});
