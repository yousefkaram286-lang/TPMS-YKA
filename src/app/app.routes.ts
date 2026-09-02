import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password.component';
import { ShellComponent } from './layout/shell/shell.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProductionComponent } from './features/production/production.component';
import { MaterialsComponent } from './features/materials/materials.component';
import { QualityComponent } from './features/quality/quality.component';
import { OutputReleaseComponent } from './features/output-release/output-release.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, publicGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [publicGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'production', component: ProductionComponent, canActivate: [adminGuard] },
      { path: 'output-release', component: OutputReleaseComponent, canActivate: [adminGuard] },
      { path: 'materials', component: MaterialsComponent, canActivate: [adminGuard] },
      { path: 'quality', component: QualityComponent, canActivate: [adminGuard] },
      { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent), canActivate: [adminGuard] },
      { path: 'users', loadComponent: () => import('./features/users/user-management.component').then(m => m.UserManagementComponent), canActivate: [adminGuard] },
      { 
        path: 'settings', 
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
        canActivate: [adminGuard] 
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
