import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SelectionTrayComponent } from './selection-tray.component';
@Component({standalone: true, imports: [SelectionTrayComponent], template: `<app-ev-selection-tray [items]="items" label="2 materiales seleccionados" [disabled]="pending()" (remove)="removed = $event"><button (click)="added = true">Agregar</button></app-ev-selection-tray>`})
class Host { items = [{id: 73, name: 'Concreto AAC'}, {id: 74, name: 'Otro equipo'}]; pending = signal(false); removed: number | undefined; added = false; }
describe('SelectionTrayComponent', () => {
  const render = async () => {await TestBed.configureTestingModule({imports: [Host]}).compileComponents(); const fixture = TestBed.createComponent(Host); fixture.detectChanges();return fixture;};
  it('announces count, labels removal and emits the exact selected ID', async () => {
    const fixture = await render(), el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')?.textContent).toContain('2 materiales seleccionados');
    const remove = el.querySelector<HTMLButtonElement>('[aria-label="Quitar de la selección: Otro equipo"]');
    expect(remove).not.toBeNull();remove!.click();expect(fixture.componentInstance.removed).toBe(74);
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });
  it('disables removal during saving while leaving action ownership with caller', async () => {
    const fixture = await render(); fixture.componentInstance.pending.set(true); await fixture.whenStable(); fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement, remove = el.querySelector<HTMLButtonElement>('[aria-label="Quitar de la selección: Concreto AAC"]');
    expect(remove).not.toBeNull();remove!.click();expect(fixture.componentInstance.removed).toBeUndefined();
    const action = Array.from(el.querySelectorAll('button')).find(b=>b.textContent === 'Agregar');
    expect(action).toBeDefined();action!.click();expect(fixture.componentInstance.added).toBe(true);
  });
});
