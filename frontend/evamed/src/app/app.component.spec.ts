import { TestBed, waitForAsync } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        provideRouter
      ],
      declarations: [
        AppComponent
      ],
    }).compileComponents();
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent),
     app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'evamed'`, () => {
    const fixture = TestBed.createComponent(AppComponent),
     app = fixture.componentInstance;
    expect(app.title).toEqual('evamed');
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.content span').textContent).toContain('evamed app is running!');
  });
});
