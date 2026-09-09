// ============================================================
// TPMS — User Management Service
// Lists existing user profiles (Admin RLS) and creates new
// Supabase Auth users via the `create-user` Edge Function.
// No service-role key or passwords are ever handled in the app.
// ============================================================
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { User } from '../models/user.model';

export interface CreateUserInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export interface CreateUserResult {
  success: boolean;
  email?: string;
  error?: string;
}

/** Whitelisted profile fields an admin may edit from the Users page. */
export interface UpdateUserPatch {
  username?: string;
  displayName?: string;
  role?: 'Admin' | 'User';
  active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private supabaseService = inject(SupabaseService);

  async listUsers(): Promise<User[]> {
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('id, username, display_name, role, department, active, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(p => ({
      id: p.id,
      username: p.username || '',
      displayName: p.display_name || '',
      role: p.role === 'Admin' ? 'Admin' : 'User',
      department: p.department,
      active: p.active !== false,
      createdAt: p.created_at
    }));
  }

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    const { data: sessionData } = await this.supabaseService.client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { success: false, error: 'Not authenticated.' };
    }

    let response: Response;
    try {
      response = await fetch(this.supabaseService.functionUrl('create-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
    } catch (err) {
      return { success: false, error: 'Unable to reach the user-creation service. Is the "create-user" Edge Function deployed?' };
    }

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, error: body?.error ?? 'Failed to create user.' };
    }

    return { success: true, email: body?.user?.email ?? input.email };
  }

  /**
   * Updates ONLY the whitelisted profile fields of an existing user's
   * profiles row. Email, password and id are never touched here — those
   * belong to Supabase Auth and are out of scope for the Users page.
   * RLS + guardian triggers still enforce that only Admins may change
   * role / active (the client publishes only the user's JWT).
   */
  async updateUser(id: string, patch: UpdateUserPatch): Promise<CreateUserResult> {
    const payload: Record<string, unknown> = {
      ['updated_at']: new Date().toISOString()
    };
    if (patch.displayName !== undefined) payload['display_name'] = patch.displayName;
    if (patch.username !== undefined) payload['username'] = patch.username;
    if (patch.role !== undefined) payload['role'] = patch.role;
    if (patch.active !== undefined) payload['active'] = patch.active;

    const { error } = await this.supabaseService.client
      .from('profiles')
      .update(payload)
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }
}