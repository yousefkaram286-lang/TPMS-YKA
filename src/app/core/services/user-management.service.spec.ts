import { TestBed } from '@angular/core/testing';

import { UserManagementService } from './user-management.service';
import { SupabaseService } from './supabase.service';

// Profile row shape, matching 20260902_base_schema.sql (profiles).
const OPERATOR_ROW = {
  id: 'usr-002',
  username: 'operator',
  display_name: 'Operator One',
  role: 'User',
  department: 'Production',
  active: true,
  created_at: '2026-08-01T08:00:00.000Z'
};

const ADMIN_ROW = {
  id: 'usr-001',
  username: 'admin',
  display_name: 'Yousef Karam',
  role: 'Admin',
  department: 'Management',
  active: true,
  created_at: '2026-08-01T08:00:00.000Z'
};

/**
 * In-memory Supabase chain stub that RECORDS every .update() payload and
 * actually applies the mutation to the seeded tables, so tests can assert
 * both "what was sent" and "what was persisted".
 */
function createHarness(tables: Record<string, any[]>) {
  const updateCalls: Array<{ table: string; column: string; value: unknown; payload: Record<string, unknown> }> = [];

  const client: any = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              updateCalls.push({ table, column, value, payload });
              const rows = tables[table] ?? [];
              for (const row of rows) {
                if (row[column] === value) {
                  Object.assign(row, payload);
                }
              }
              return Promise.resolve({ data: rows, error: null });
            }
          };
        },
        select(): any {
          return {
            order(): Promise<any> {
              return Promise.resolve({ data: tables[table] ?? [], error: null });
            }
          };
        }
      };
    }
  };

  TestBed.configureTestingModule({
    providers: [
      UserManagementService,
      { provide: SupabaseService, useValue: { client } }
    ]
  });

  return {
    svc: TestBed.inject(UserManagementService),
    tables,
    updateCalls
  };
}

describe('UserManagementService (users page admin actions)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('updates display name via display_name and touches only whitelisted fields', async () => {
    const { svc, tables, updateCalls } = createHarness({ profiles: [{ ...OPERATOR_ROW }] });

    const result = await svc.updateUser('usr-002', { displayName: 'Renamed Operator' } as any);

    expect(result.success).toBeTrue();
    expect(updateCalls).toHaveSize(1);
    const call = updateCalls[0];
    expect(call.table).toBe('profiles');
    expect(call.column).toBe('id');
    expect(call.value).toBe('usr-002');
    expect(call.payload['display_name']).toBe('Renamed Operator');
    expect(call.payload['username']).toBeUndefined();
    expect(call.payload['role']).toBeUndefined();
    expect(call.payload['active']).toBeUndefined();
    expect(call.payload['updated_at']).toBeDefined();
    expect(call.payload['email']).toBeUndefined();
    expect(tables['profiles'][0].display_name).toBe('Renamed Operator');
  });

  it('updates username via username', async () => {
    const { svc, tables, updateCalls } = createHarness({ profiles: [{ ...OPERATOR_ROW }] });

    const result = await svc.updateUser('usr-002', { username: 'operator-v2' });

    expect(result.success).toBeTrue();
    expect(updateCalls[0].payload['username']).toBe('operator-v2');
    expect(updateCalls[0].payload['display_name']).toBeUndefined();
    expect(updateCalls[0].payload['role']).toBeUndefined();
    expect(updateCalls[0].payload['active']).toBeUndefined();
    expect(tables['profiles'][0].username).toBe('operator-v2');
  });

  it('changes role User to Admin and back (role whitelist-only)', async () => {
    const { svc, updateCalls } = createHarness({ profiles: [{ ...OPERATOR_ROW }] });

    const promote = await svc.updateUser('usr-002', { role: 'Admin' });
    expect(promote.success).toBeTrue();
    expect(updateCalls[0].payload['role']).toBe('Admin');

    const demote = await svc.updateUser('usr-002', { role: 'User' });
    expect(demote.success).toBeTrue();
    expect(updateCalls[1].payload['role']).toBe('User');
    expect(updateCalls[1].payload['active']).toBeUndefined();
  });

  it('deactivates a user by setting active=false', async () => {
    const { svc, tables, updateCalls } = createHarness({ profiles: [{ ...OPERATOR_ROW }] });

    const result = await svc.updateUser('usr-002', { active: false });

    expect(result.success).toBeTrue();
    expect(updateCalls[0].payload['active']).toBe(false);
    expect(tables['profiles'][0].active).toBe(false);
  });

  it('reactivates a user by setting active=true', async () => {
    const { svc, tables } = createHarness({ profiles: [{ ...OPERATOR_ROW, active: false }] });

    const result = await svc.updateUser('usr-002', { active: true });

    expect(result.success).toBeTrue();
    expect(tables['profiles'][0].active).toBe(true);
  });

  it('combines several whitelisted fields in one patch without email/password', async () => {
    const { svc, updateCalls } = createHarness({ profiles: [{ ...OPERATOR_ROW }] });

    const result = await svc.updateUser('usr-002', {
      displayName: 'New Name',
      role: 'Admin',
      active: false
    });

    expect(result.success).toBeTrue();
    const payload = updateCalls[0].payload;
    expect(payload['display_name']).toBe('New Name');
    expect(payload['role']).toBe('Admin');
    expect(payload['active']).toBe(false);
    expect(payload['username']).toBeUndefined();
    expect(payload['email']).toBeUndefined();
    expect(payload['password']).toBeUndefined();
  });

  it('returns an error instead of a false success when the update fails', async () => {
    const failingClient: any = {
      from: () => ({
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: 'Row violates policy' } })
        })
      })
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        UserManagementService,
        { provide: SupabaseService, useValue: { client: failingClient } }
      ]
    });
    const svc = TestBed.inject(UserManagementService);

    const result = await svc.updateUser('usr-002', { active: false });

    expect(result.success).toBeFalse();
    expect(result.error).toContain('Row violates policy');
  });

  it('exposes NOTHING that deletes users or profiles', () => {
    const { svc } = createHarness({ profiles: [{ ...OPERATOR_ROW }, { ...ADMIN_ROW }] });

    expect((svc as any).deleteUser).toBeUndefined();
    expect((svc as any).delete).toBeUndefined();
    expect((svc as any).removeUser).toBeUndefined();
    expect((svc as any).remove).toBeUndefined();
  });
});