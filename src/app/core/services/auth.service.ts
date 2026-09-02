import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { User, LoginCredentials, LoginResponse } from '../models/user.model';
import { SupabaseService } from './supabase.service';
import { SupabaseMasterDataSeedService } from './supabase-master-data-seed.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabaseService = inject(SupabaseService);
  private supabaseMasterDataSeed = inject(SupabaseMasterDataSeedService);
  private router = inject(Router);

  // Signals for reactive state
  private _currentUser = signal<User | null>(null);
  private _isLoading  = signal<boolean>(true);
  private _authListenerAttached = false;

  // Resolves once the initial Supabase session check + profile restore complete.
  // Guards await this so they never decide "logged out" before getSession() finishes.
  private resolveAuthReady!: () => void;
  readonly authReady: Promise<void> = new Promise(resolve => {
    this.resolveAuthReady = resolve;
  });

  // Public computed reads
  readonly currentUser    = this._currentUser.asReadonly();
  readonly isLoading      = this._isLoading.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isAdmin        = computed(() => this._currentUser()?.role === 'Admin');
  readonly isUser         = computed(() => this._currentUser()?.role === 'User');
  readonly userRole       = computed(() => this._currentUser()?.role ?? null);

  constructor() {
    this.initAuth();
  }

  /** Awaits completion of the initial session restore. Safe to call any time. */
  async ready(): Promise<void> {
    await this.authReady;
  }

  private async initAuth() {
    try {
      // 1. Restore the persisted session before anything else.
      const { data: { session } } = await this.supabaseService.client.auth.getSession();
      if (session?.user) {
        await this.loadUserProfile(session.user);
      } else {
        this._currentUser.set(null);
      }
    } catch (err) {
      console.error('Auth initialization failed:', err);
      this._currentUser.set(null);
    } finally {
      // 2. Signal that initialization is complete (guards may now decide).
      this._isLoading.set(false);
      this.resolveAuthReady?.();
    }

    // 3. Listen for auth changes (token refresh, sign-out in another tab, etc.).
    if (!this._authListenerAttached) {
      this._authListenerAttached = true;
      this.supabaseService.client.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          await this.loadUserProfile(session.user);
          // Central master data (Lines/Products/Materials + Line↔Product mappings)
          // is seeded additively from Supabase. Best-effort, gated by idempotency.
          await this.supabaseMasterDataSeed.runSeed().catch(err =>
            console.warn('[Auth] Supabase master data seed skipped:', err?.message ?? err)
          );
        } else {
          this._currentUser.set(null);
          if (event === 'SIGNED_OUT') {
            this.router.navigate(['/login']);
          }
        }
      });
    }
  }

  private async loadUserProfile(authUser: any) {
    const { data: profile, error } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error || !profile) {
      console.error('Failed to load user profile:', error);
      // Fallback if profile doesn't exist yet (trigger normally auto-creates it).
      this._currentUser.set({
        id: authUser.id,
        username: authUser.email?.split('@')[0] || 'User',
        displayName: authUser.email?.split('@')[0] || 'User',
        email: authUser.email,
        role: 'User',
        active: true,
      });
      return;
    }

    if (profile.active === false) {
      // Disabled account → block access: sign out safely and return to Login.
      this._currentUser.set(null);
      await this.supabaseService.client.auth.signOut();
      this.router.navigate(['/login']);
      return;
    }

    this._currentUser.set({
      id: authUser.id,
      username: profile.username || '',
      displayName: profile.display_name || '',
      email: authUser.email,
      role: profile.role === 'Admin' ? 'Admin' : 'User',
      department: profile.department,
      active: profile.active !== false
    });
  }

  // ── Login ──────────────────────────────────────────────────
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    this._isLoading.set(true);
    
    // UI might send "username" field, but we are using Supabase Auth which requires email
    const email = credentials.username.trim();

    const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password: credentials.password,
    });

    if (error) {
      this._isLoading.set(false);
      return { success: false, error: error.message };
    }

    // Load the profile NOW so role/state exist before navigation/guards run.
    if (data.user) {
      await this.loadUserProfile(data.user);
    } else {
      this._currentUser.set(null);
    }
    this._isLoading.set(false);

    return { success: true, token: data.session?.access_token };
  }

  login$(credentials: LoginCredentials): Observable<LoginResponse> {
    return from(this.login(credentials));
  }

  // ── Logout ─────────────────────────────────────────────────
  async logout(): Promise<void> {
    this._currentUser.set(null);
    await this.supabaseService.client.auth.signOut();
    this.router.navigate(['/login']);
  }

  // ── Role Checks ───────────────────────────────────────────
  hasRole(role: 'Admin' | 'User'): boolean {
    return this.userRole() === role;
  }

  canAccessRoute(allowedRoles: ('Admin' | 'User')[]): boolean {
    const role = this.userRole();
    if (!role) return false;
    return allowedRoles.includes(role);
  }

  // ── Profile Updates ────────────────────────────────────────
  async updateProfile(data: { displayName: string; username: string }): Promise<{ success: boolean; error?: string }> {
    const user = this._currentUser();
    if (!user) return { success: false, error: 'Not authenticated.' };

    const { error } = await this.supabaseService.client
      .from('profiles')
      .update({
        display_name: data.displayName,
        username: data.username,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    // Update local state immediately
    this._currentUser.set({
      ...user,
      displayName: data.displayName,
      username: data.username
    });

    return { success: true };
  }

  async updatePassword(currentPass: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    // Supabase Auth handles password changes natively via updateUser
    // Note: Supabase doesn't strictly verify currentPassword in updateUser from the client,
    // it relies on the active session. If session is valid, it changes it.
    // However, some configurations require re-authentication. 
    // We will attempt to sign in to verify current password first as a safety check if desired.

    const user = this._currentUser();
    if (!user?.email) return { success: false, error: 'Not authenticated.' };

    // 1. Verify current password
    const { error: signInError } = await this.supabaseService.client.auth.signInWithPassword({
      email: user.email,
      password: currentPass
    });

    if (signInError) {
      return { success: false, error: 'Incorrect current password.' };
    }

    // 2. Update password
    const { error: updateError } = await this.supabaseService.client.auth.updateUser({
      password: newPass
    });

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  }

  // ── Password Reset (Forgot Password) ───────────────────────
  async lookupEmailForReset(email: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    // With Supabase Auth, we don't lookup the email and return a userId to the client for security.
    // Instead, we just trigger the reset email.
    const { error } = await this.supabaseService.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // We return success, but we don't return a userId. The UI should just show "Check your email".
    // To adapt to the existing component without breaking it entirely, we'll return a fake userId
    // so it moves to the next step, OR we can modify the component. 
    // Actually, I will modify the component to just show success after this.
    return { success: true, userId: 'supabase-email-sent' };
  }

  async resetPassword(userId: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    // If the user arrived here via the reset email link, they will have a valid session.
    const { error } = await this.supabaseService.client.auth.updateUser({
      password: newPass
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }
}
