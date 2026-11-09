import { referenceRoutes } from './reference.routes';
import { referenceRoutes as productionRoutes } from './reference.routes.prod';
describe('design system reference build boundary', () => {
  it('provides a lazy reference in development and no route in production', () => {
    expect(referenceRoutes.map(route => route.path)).toEqual(['design-system']);
    expect(referenceRoutes[0].loadComponent).toBeTypeOf('function');
    expect(productionRoutes).toEqual([]);
  });
});
