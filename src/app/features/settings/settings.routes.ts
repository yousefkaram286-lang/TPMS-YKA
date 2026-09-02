import { Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsComponent,
    children: [
      { path: '', redirectTo: 'products', pathMatch: 'full' },
      { path: 'products', loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent) },
      { path: 'materials', loadComponent: () => import('./materials/materials.component').then(m => m.MaterialsSettingsComponent) },
      { path: 'lines', loadComponent: () => import('./lines/lines.component').then(m => m.LinesComponent) },
      { path: 'shifts', loadComponent: () => import('./shifts/shifts.component').then(m => m.ShiftsComponent) },
      { path: 'machines', loadComponent: () => import('./machines/machines.component').then(m => m.MachinesComponent) },
      { path: 'recipes', loadComponent: () => import('./recipes/recipes.component').then(m => m.RecipesComponent) },
      { path: 'production-config', loadComponent: () => import('./product-machine/product-machine.component').then(m => m.ProductMachineComponent) },
      { path: 'unit-costs', loadComponent: () => import('./unit-costs/unit-costs.component').then(m => m.UnitCostsComponent) }
    ]
  }
];
