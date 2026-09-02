// ============================================================
// TPMS — Role Guards
// adminGuard:   authenticated + Admin only (redirects otherwise)
// publicGuard:  redirects already-authenticated users away from
//               Login/Forgot-Password; blocks nothing for guests.
// ============================================================
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async (_route, _state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Wait for the persisted session restore before deciding.
  if (auth.isLoading()) {
    await auth.ready();
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (auth.hasRole('Admin')) {
    return true;
  }

  // Authenticated non-admin user → Dashboard only.
  return router.createUrlTree(['/dashboard']);
};

export const publicGuard: CanActivateFn = async (_route, _state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Wait for session restore so we never bounce an authenticated user.
  if (auth.isLoading()) {
    await auth.ready();
  }

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};