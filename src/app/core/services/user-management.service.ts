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
}