import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, throwError } from 'rxjs';

// Compile the pages in their NgModule's context.
import './materials-stage.module';
import { MaterialStageUpdateComponent } from './components/material-stage-update/material-stage-update.component';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { parseQuantity, QuantityCellComponent } from '../shared/components/quantity-cell/quantity-cell.component';

describe('Quantity edited in the Materiales list', () => {
  const render = async (value: number | string = 120.5) => {
    TestBed.configureTestingModule({
      imports: [FormsModule, MatTooltipModule],
      declarations: [QuantityCellComponent],
    });
    const fixture = TestBed.createComponent(QuantityCellComponent),
      emitted: number[] = [],
      rowClicks = vi.fn();
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('unit', 'kg');
    fixture.componentInstance.changed.subscribe(quantity => emitted.push(quantity));
    // Stands in for the list row, which opens Edición on a click.
    fixture.nativeElement.addEventListener('click', rowClicks);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement,
      open = () => {
        el.querySelector<HTMLButtonElement>('button.quantity')!.click();
        fixture.detectChanges();
        return el.querySelector<HTMLInputElement>('input')!;
      },
      type = (input: HTMLInputElement, text: string) => {
        input.value = text;
        input.dispatchEvent(new Event('input'));
      },
      key = (input: HTMLInputElement, name: string) => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
        fixture.detectChanges();
      };
    return { fixture, el, emitted, rowClicks, open, type, key };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('shows the quantity as a button with its unit for screen readers', async () => {
    const { el } = await render(),

     button = el.querySelector('button.quantity')!;
    expect(button.textContent!.trim()).toBe('120.50');
    expect(button.getAttribute('aria-label')).toBe('Editar cantidad: 120.5 kg');
  });

  it('a click opens a focused box with the value, without opening Edición', async () => {
    const { open, rowClicks } = await render(),

     input = open();

    expect(input.value).toBe('120.5');
    expect(document.activeElement).toBe(input);
    expect(rowClicks).not.toHaveBeenCalled();
  });

  it('Enter saves the new value, and the box closes', async () => {
    const { el, open, type, key, emitted } = await render(),
     input = open();

    type(input, '95,25');
    key(input, 'Enter');

    expect(emitted).toEqual([95.25]);
    expect(el.querySelector('input')).toBeNull();
  });

  it('clicking away saves too', async () => {
    const { fixture, open, type, emitted } = await render(),
     input = open();

    type(input, '7');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(emitted).toEqual([7]);
  });

  it('Esc puts the old value back', async () => {
    const { el, open, type, key, emitted } = await render(),
     input = open();

    type(input, '7');
    key(input, 'Escape');
    input.dispatchEvent(new Event('blur'));

    expect(emitted).toEqual([]);
    expect(el.querySelector('button.quantity')!.textContent!.trim()).toBe('120.50');
  });

  it('keeps keys away from the list underneath', async () => {
    const { el, open } = await render(),
      listKeys = vi.fn();
    el.addEventListener('keydown', listKeys);

    open().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(listKeys).not.toHaveBeenCalled();
  });

  it('saves nothing for a blank, negative or unreadable value: the box stays open and says why', async () => {
    const { el, open, type, key, emitted } = await render();
    const input = open();
    for (const text of ['', '-3', 'abc']) {
      type(input, text);
      key(input, 'Enter');
      expect(el.querySelector('input')).toBe(input);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(el.querySelector('.quantity__error')!.textContent!.trim()).toBe('Escribe un número igual o mayor a cero.');
    }
    key(input, 'Escape');
    expect(el.querySelector('input')).toBeNull();
    expect(emitted).toEqual([]);
  });

  it('closes without saving an unchanged value', async () => {
    const { el, open, type, key, emitted } = await render();
    const input = open();
    type(input, '120.5');
    key(input, 'Enter');
    expect(emitted).toEqual([]);
    expect(el.querySelector('input')).toBeNull();
  });

  it('accepts a decimal comma, 0 (R-47), and only finite numbers that aren’t negative', () => {
    expect(parseQuantity(' 3,5 ')).toBe(3.5);
    expect(parseQuantity('0')).toBe(0);
    expect(Object.is(parseQuantity('-0'), 0)).toBe(true);
    expect(parseQuantity('-0.5')).toBeNull();
    expect(parseQuantity('1e400')).toBeNull();
  });

  it('saves 0', async () => {
    const { open, type, key, emitted } = await render(),
      input = open();
    type(input, '0');
    key(input, 'Enter');

    expect(emitted).toEqual([0]);
  });

  it('new-project page: changes the row and stores the sheet for the autosave', () => {
    const component: any = Object.create(MaterialsStageComponent.prototype),
      row = { Material: 'Block', Cantidad: 5 };
    component.listData = [row];
    component.indexSheet = 0;
    component.contentData = [component.listData];
    component.sheetNames = ['Muros exteriores'];
    sessionStorage.setItem('dataProject', JSON.stringify({ data: [[]] }));

    component.setQuantity(row, 12.5);

    expect(row.Cantidad).toBe(12.5);
    expect(JSON.parse(sessionStorage.getItem('dataProject')!).data[0][0].Cantidad).toBe(12.5);
    sessionStorage.clear();
  });

  describe('existing-project page', () => {
    const build = (response: any) => {
      const component: any = Object.create(MaterialStageUpdateComponent.prototype),
        row: Record<string, any> = { material_scheme_project_id: 10, quantity: 5 };
      component.listData2 = [{ id: 10, quantity: 5 }];
      component.cdr = { markForCheck: vi.fn() };
      component.snackBar = { open: vi.fn() };
      component.projectsService = { patchMaterialSchemeProject: vi.fn(() => response) };
      return { component, row };
    };

    it('saves only the quantity of that row', () => {
      const { component, row } = build(of({}));

      component.setQuantity(row, 12.5);

      expect(component.projectsService.patchMaterialSchemeProject).toHaveBeenCalledWith(10, { quantity: 12.5 });
      expect(row['quantity']).toBe(12.5);
      expect(component.listData2[0].quantity).toBe(12.5);
    });

    it('puts the old quantity back and says so when the save fails', () => {
      const { component, row } = build(throwError(() => ({ status: 400 })));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      component.setQuantity(row, 12.5);

      expect(row['quantity']).toBe(5);
      expect(component.listData2[0].quantity).toBe(5);
      expect(component.snackBar.open).toHaveBeenCalledWith(
        'No se pudo guardar la cantidad. Intenta de nuevo.', 'Cerrar', { duration: 6000 }
      );
    });
  });
});


describe('In-place cell options (in-place editing plan, Task 1)', () => {
  const render = async (inputs: Record<string, unknown>) => {
    TestBed.configureTestingModule({ imports: [FormsModule, MatTooltipModule], declarations: [QuantityCellComponent] });
    const fixture = TestBed.createComponent(QuantityCellComponent), emitted: number[] = [];
    fixture.componentRef.setInput('value', 3);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.componentInstance.changed.subscribe(value => emitted.push(value));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement,
      enter = (text: string) => {
        el.querySelector<HTMLButtonElement>('button.quantity')?.click();
        fixture.detectChanges();
        const input = el.querySelector<HTMLInputElement>('input')!;
        input.value = text;
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();
        return input;
      };
    return { el, emitted, enter };
  };
  afterEach(() => TestBed.resetTestingModule());

  it('rejects a decimal when whole numbers are required', async () => {
    const { el, emitted, enter } = await render({ integer: true });
    enter('2.5');
    expect(emitted).toEqual([]);
    expect(el.querySelector('.quantity__error')!.textContent!.trim()).toBe('Escribe un número entero igual o mayor a cero.');
  });

  it('rejects a value over the maximum', async () => {
    const { el, emitted, enter } = await render({ integer: true, max: 100 });
    enter('101');
    expect(emitted).toEqual([]);
    expect(el.querySelector('.quantity__error')!.textContent!.trim()).toBe('Escribe un número entre 0 y 100.');
    enter('40');
    expect(emitted).toEqual([40]);
  });

  it('shows the display text when given, and names the field for screen readers', async () => {
    const { el } = await render({ display: '3 %', label: 'porcentaje' });
    const button = el.querySelector('button.quantity')!;
    expect(button.textContent!.trim()).toBe('3 %');
    expect(button.getAttribute('aria-label')).toBe('Editar porcentaje: 3');
  });

  it('does not open while disabled', async () => {
    const { el } = await render({ disabled: true });
    const button = el.querySelector<HTMLButtonElement>('button.quantity')!;
    expect(button.disabled).toBe(true);
    button.click();
    expect(el.querySelector('input')).toBeNull();
  });
});
