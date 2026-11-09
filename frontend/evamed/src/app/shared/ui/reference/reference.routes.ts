import { Routes } from '@angular/router';
export const referenceRoutes: Routes = [{path: 'design-system', loadComponent: ()=>import('./reference.component').then(m=>m.ReferenceComponent)}];
