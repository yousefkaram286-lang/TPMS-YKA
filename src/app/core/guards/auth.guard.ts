// ============================================================
// TPMS — Auth Guard
// ============================================================
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, _state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Never decide "logged out" before the persisted session has been checked.
  if (auth.isLoading()) {
    await auth.ready();
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};