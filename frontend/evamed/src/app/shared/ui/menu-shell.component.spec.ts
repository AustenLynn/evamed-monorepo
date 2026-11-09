import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MenuShellComponent } from './menu-shell.component';
@Component({standalone: true, imports: [MenuShellComponent], template: `<app-ev-menu-shell><header evMenuHeader><h1>Explorar material</h1><button [disabled]="pending()" (click)="closed = true">Cerrar</button></header><p>Contenido</p><footer evMenuFooter>Acciones</footer></app-ev-menu-shell>`})
class Host { pending = signal(true); closed = false; }
describe('MenuShellComponent', () => {
  it('projects header, body and footer in order without taking over close behaviour', async () => {
    await TestBed.configureTestingModule({imports: [Host]}).compileComponents();
    const fixture = TestBed.createComponent(Host); fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ev-menu-body')?.textContent).toContain('Contenido');
    expect(el.textContent).toMatch(/Explorar material.*Cerrar.*Contenido.*Acciones/s);
    const close = el.querySelector('button')!; close.click(); expect(fixture.componentInstance.closed).toBe(false);
    fixture.componentInstance.pending.set(false); await fixture.whenStable(); fixture.detectChanges(); close.click(); expect(fixture.componentInstance.closed).toBe(true);
  });
});
