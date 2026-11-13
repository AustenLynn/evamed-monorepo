# Routes
/materials-stage and /update; /construction-stage and /update; /end-life-stage and /update; /explorador/:stage. All use LayoutComponent shell.
## `frontend/evamed/src/app/app-routing.module.ts`
```ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule, NoPreloading } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AdminGuard } from './admin.guard';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: '/home-evamed',
        pathMatch: 'full',
      },
      {
        path: 'home-evamed',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./home-evamed/home-evamed.module').then(
            m => m.HomeEvamedModule
          ),
      },
      {
        path: 'do-files',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./to-do-file/to-do-file.module').then(
            m => m.ToDoFileModule
          ),
      },
      {
        path: 'materials-stage',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./materials-stage/materials-stage.module').then(
            m => m.MaterialsStageModule
          ),
      },
      {
        path: 'construction-stage',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./construction-stage/construction-stage.module').then(
            m => m.ConstructionStageModule
          ),
      },
      {
        path: 'usage-stage',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./usage-stage/usage-stage.module').then(
            m => m.UsageStageModule
          ),
      },
      {
        path: 'end-life-stage',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./end-life-stage/end-life-stage.module').then(
            m => m.EndLifeStageModule
          ),
      },
      {
        path: 'explorador',
        canActivate: [AdminGuard],
        data: { layout: 'wide' },
        loadChildren: () =>
          import('./explorer/explorer.module').then(m => m.ExplorerModule),
      },
      {
        path: 'resultados',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./comparar/comparar.module').then(m => m.CompararModule),
      },
      {
        path: 'admin-materials',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./materials-admin/materials-admin.module').then(
            m => m.MaterialsAdminModule
          ),
      },
      {
        path: 'admin-units',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./units-admin/units-admin.module').then(
            m => m.UnitsAdminModule
          ),
      },
      {
        path: 'admin-db-materials',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./data-base-admin/data-base-admin.module').then(
            m => m.DataBaseAdminModule
          ),
      },
      {
        path: 'admin-potential',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./potential-admin/potential-admin.module').then(
            m => m.PotentialAdminModule
          ),
      },
      {
        path: 'admin-transports',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./transport-admin/transport-admin.module').then(
            m => m.TransportAdminModule
          ),
      },
      {
        path: 'admin-machinery',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./machinery-admin/machinery-admin.module').then(
            m => m.MachineryAdminModule
          ),
      },
      {
        path: 'admin-energy',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./energy-admin/energy-admin.module').then(
            m => m.EnergyAdminModule
          ),
      },
      {
        path: 'admin-others',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./others-admin/others-admin.module').then(
            m => m.OthersAdminModule
          ),
      },
      {
        path: 'admin',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./principal-admin/principal-admin.module').then(
            m => m.PrincipalAdminModule
          ),
      },
      {
        path: 'about',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./about/about.module').then(m => m.AboutModule),
      },
      {
        path: 'user-manual',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./user-manual/user-manual.module').then(
            m => m.UserManualModule
          ),
      },
    ],
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule),
  },
  {
    path: '**',
    loadChildren: () =>
      import('./page-not-found/page-not-found.module').then(
        m => m.PageNotFoundModule
      ),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: NoPreloading,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}

```

## `frontend/evamed/src/app/materials-stage/materials-stage-routing.module.ts`
```ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MaterialsStageComponent } from './components/materials-stage/materials-stage.component';
import { MaterialStageUpdateComponent } from './components/material-stage-update/material-stage-update.component';

const routes: Routes = [
  {
    path: '',
    component: MaterialsStageComponent
  },
  {
    path: 'update',
    component: MaterialStageUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MaterialsStageRoutingModule { }

```

## `frontend/evamed/src/app/construction-stage/construction-stage-routing.module.ts`
```ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ConstructionStageComponent } from './components/construction-stage/construction-stage.component';
import { ConstructionStageUpdateComponent } from './components/construction-stage-update/construction-stage-update.component';


const routes: Routes = [
  {
    path: '',
    component: ConstructionStageComponent
  },
  {
    path: 'update',
    component: ConstructionStageUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConstructionStageRoutingModule { }

```

## `frontend/evamed/src/app/end-life-stage/end-life-stage-routing.module.ts`
```ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EndLifeStageComponent } from './components/end-life-stage/end-life-stage.component';
import { EndLifeUpdateComponent } from './components/end-life-update/end-life-update.component';


const routes: Routes = [
  {
    path: '',
    component: EndLifeStageComponent
  },
  {
    path: 'update',
    component: EndLifeUpdateComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EndLifeStageRoutingModule { }

```

## `frontend/evamed/src/app/explorer/explorer-routing.module.ts`
```ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ExplorerPageComponent } from './components/explorer-page/explorer-page.component';
import { MaterialDetailPageComponent } from './components/material-detail-page/material-detail-page.component';
import { STAGES } from './stage-config';

const routes: Routes = [
  { path: '', redirectTo: 'produccion', pathMatch: 'full' },
  { path: 'produccion/:id', component: MaterialDetailPageComponent },
  ...STAGES.map(stage => ({
    path: stage.key,
    component: ExplorerPageComponent,
    data: { stage: stage.key },
  })),
  { path: '**', redirectTo: 'produccion' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ExplorerRoutingModule {}

```
