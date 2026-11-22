import { TestBed } from '@angular/core/testing';
import '../../user-manual.module';
import { UserManualComponent } from './user-manual.component';

describe('User manual (audit A-20)', () => {
  it('is a real guide, not the Angular placeholder', () => {
    const fixture = TestBed.createComponent(UserManualComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('works!');
    expect(el.querySelector('h1')?.textContent).toBe('Manual de usuario');
    expect(el.querySelectorAll('section').length).toBe(10);
  });
});
