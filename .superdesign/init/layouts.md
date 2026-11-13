# Shared application shell
Header above routed content, footer below. Standard content max-width 65rem; explorer wide variant 1440px.
## `frontend/evamed/src/app/layout/layout.component.html`
```html
<app-header></app-header>


<div class="container" [class.container--wide]="wide$ | async">
  <router-outlet></router-outlet>
</div>

<app-footer></app-footer>

```

## `frontend/evamed/src/app/layout/layout.component.scss`
```scss

```

## `frontend/evamed/src/app/layout/layout.component.ts`
```ts
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';

const asksForWide = (route: ActivatedRouteSnapshot): boolean =>
  route.data?.['layout'] === 'wide' || route.children.some(asksForWide);

@Component({
    selector: 'app-layout',
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LayoutComponent {
  /** True while any active route has data: { layout: 'wide' } (the explorer). */
  readonly wide$: Observable<boolean>;

  constructor(router: Router) {
    this.wide$ = router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith(null),
      map(() => asksForWide(router.routerState.snapshot.root))
    );
  }
}

```

## `frontend/evamed/src/app/shared/components/header/header.component.html`
```html
<mat-toolbar class='header-app'>
  <mat-toolbar-row>
    <div class="row between-xs middle-xs header-row">
      <div class="container-title" >
        <img src="../../../../assets/relevants/logo.png" (click)="goToHome()" class="logo-header"
          (keypress)="goToHome()" tabindex="1" alt="EVAMED logo"/>
      </div>
      <div class="container-icons">
        <div class="container-icon" (click)="goToAbout()" (keypress)="goToAbout()" tabindex="2">
          <div class="icon-acerca-de"></div>
          <div class="title-icon">
            Acerca de
          </div>
        </div>
        <div class="container-icon" (click)="goToUserManual()" (keypress)="goToUserManual()" tabindex="3">
          <div class="icon-bosquejo"></div>
          <div class="title-icon">
            Manual de usuario
          </div>
        </div>
      </div>
    </div>
  </mat-toolbar-row>
</mat-toolbar>

```

## `frontend/evamed/src/app/shared/components/header/header.component.scss`
```scss
.header-row {
  width: 100%;
}

.mat-toolbar-multiple-rows {
  justify-content: center!important;
  flex-direction: inherit!important;
}

mat-toolbar.mat-toolbar.header-app.mat-toolbar-multiple-rows {
  background: #FFFFFF 0% 0% no-repeat padding-box;
  box-shadow: 0px 3px 6px #00000029 !important;
  margin-bottom: 14px;
}

.mat-toolbar-row {
  max-width: 65rem !important;
}

.container-title {
  display: flex;

  .title-header {
    font-weight: bold;
    font-size: 36px;
    text-align: left;
    letter-spacing: 0px;
    color: #A8D024;
    margin-top: auto;
  }

  .subtitle-header {
    font-size: 14px;
    text-align: left;
    letter-spacing: 0px;
    color: #767676;
    line-height: 90%;
    margin-left: 8px;
    margin-top: 4px;
  }
}

.container-icons {
  display: flex;
}

.container-icon {
  display: block;
  text-align: -webkit-center;
  width: 120px;
  padding-top: 20px;
  cursor: pointer;

  &:hover {
    background-color: #FDE47B;

    .title-icon {
      font-weight: bold;
    }
  }

  .icon-bosquejo {
    background: url('./../../../../assets/icons/bosquejo.svg');
    background-repeat: no-repeat;
    width: 28px;
    height: 28px;
    background-size: 28px 28px;
    display: block;
  }

  .icon-comparar {
    background: url('./../../../../assets/icons/comparar.svg');
    background-repeat: no-repeat;
    width: 28px;
    height: 28px;
    background-size: 28px 28px;
    display: block;
  }

  .icon-acerca-de {
    background: url('./../../../../assets/icons/informacion.svg');
    background-repeat: no-repeat;
    width: 28px;
    height: 28px;
    background-size: 28px 28px;
    display: block;
  }

  .title-icon {
    font-size: 12px;
    text-align: center;
    color: #767676;
  }
}

.logo-header {
  cursor: pointer;
}


```

## `frontend/evamed/src/app/shared/components/header/header.component.ts`
```ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { map } from 'rxjs/operators';
import { CartService } from './../../../core/services/cart.service';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class HeaderComponent implements OnInit {
  total$: Observable<number>;

  constructor(private cartService: CartService, private router: Router) {
    this.total$ = this.cartService.cart$.pipe(
      map(products => products.length)
    );
  }

  ngOnInit(): void {}

  goToHome() {
    this.router.navigateByUrl('/');
  }

  goToAbout() {
    this.router.navigateByUrl('/about');
  }

  goToUserManual() {
    this.router.navigateByUrl('/user-manual');
  }
}

```

## `frontend/evamed/src/app/shared/components/footer/footer.component.html`
```html
<footer>
  <div class="logos-ibero">
    <div class="img-footer">
      <img src="../../../../assets/relevants/DAUIC_Horizontal_Color.jpg" style="height:60px" alt="DAUIC logo"/>
      <div class="middle-message">
        Departamento de Arquitectura, Urbanismo e Ingeniería Civil
        <br />
        Universidad Iberoamericana Ciudad de México
        <br />
        Prol. Paseo de la Reforma No. 880, Lomas de Santa Fe, 01219. Álvaro Obregón
      </div>
    </div>
    <div class="phone">
      evamed&#64;ibero.mx
      <br />
      +(55)5950-4000 Ext. 7736
    </div>
  </div>
</footer>

```

## `frontend/evamed/src/app/shared/components/footer/footer.component.scss`
```scss
footer {
  background-color: white;
  position: absolute;
  width: 100%;
  display: flex;
  justify-content: center;

  .logos-ibero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    width: 65rem;
    padding: 20px 0;
    color: #767676;

    .img-footer {
      display: flex;

      .middle-message {
        margin-left: 10px;
      }
    }

  }

}

.phone {
  text-align: right;
}
```

## `frontend/evamed/src/app/shared/components/footer/footer.component.ts`
```ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormControl, Validators } from '@angular/forms';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class FooterComponent implements OnInit {

  emailField: UntypedFormControl;

  constructor() {
    this.emailField = new UntypedFormControl('', [
      Validators.required,
      Validators.email
    ]);
    // this.emailField.valueChanges
    // .subscribe(value => {
    //   console.log(value);
    // });
  }

  ngOnInit() {
  }

  sendMail() {
    if (this.emailField.valid) {
      console.log(this.emailField.value);
    }
  }

}

```
