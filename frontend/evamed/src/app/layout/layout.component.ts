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
