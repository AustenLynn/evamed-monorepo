// Compile LayoutComponent in its NgModule's context.
import '../app.module';

import { ActivatedRouteSnapshot, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { LayoutComponent } from './layout.component';

// The global .container caps pages at 65rem; the explorer's routes ask for
// more room with data: { layout: 'wide' }, anywhere above them in the tree.
describe('LayoutComponent', () => {
  const route = (data: object, children: ActivatedRouteSnapshot[] = []) =>
      ({ data, children }) as unknown as ActivatedRouteSnapshot,
    setup = (root: ActivatedRouteSnapshot) => {
      const events = new Subject<unknown>(),
        router = { events, routerState: { snapshot: { root } } },
        component = new LayoutComponent(router as unknown as Router),
        seen: boolean[] = [];
      component.wide$.subscribe(wide => seen.push(wide));
      return { router, events, seen };
    },
    narrowTree = route({}, [route({}, [route({})])]),
    wideTree = route({}, [route({}, [route({ layout: 'wide' }, [route({ stage: 'uso' })])])]);

  it('keeps the standard width on ordinary pages', () => {
    const { seen } = setup(narrowTree);

    expect(seen).toEqual([false]);
  });

  it('widens when a route above the page asks for it', () => {
    const { seen } = setup(wideTree);

    expect(seen).toEqual([true]);
  });

  it('follows navigation, once each navigation ends', () => {
    const { router, events, seen } = setup(narrowTree);

    router.routerState.snapshot.root = wideTree;
    events.next(new NavigationStart(1, '/explorador/uso'));
    events.next(new NavigationEnd(1, '/explorador/uso', '/explorador/uso'));
    router.routerState.snapshot.root = narrowTree;
    events.next(new NavigationEnd(2, '/home-evamed', '/home-evamed'));

    expect(seen).toEqual([false, true, false]);
  });
});
