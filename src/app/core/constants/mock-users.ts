// ============================================================
// TPMS — Mock Users
// ============================================================
import { User } from '../models/user.model';

export interface MockCredential {
  username: string;
  password: string;
  userId: string;
}

export const MOCK_USERS: User[] = [
  {
    id: 'usr-001',
    username: 'admin',
    displayName: 'Yousef Karam',
    email: 'yousefkaram286@gmail.com',
    role: 'Admin',
    active: true,
    department: 'Management',
  },
  {
    id: 'usr-002',
    username: 'user',
    displayName: 'Yousef Karam',
    email: 'user@tpms.factory',
    role: 'User',
    active: true,
    department: 'Production',
  },
];

export const MOCK_CREDENTIALS: MockCredential[] = [
  { username: 'admin', password: 'admin123', userId: 'usr-001' },
  { username: 'user',  password: 'user123',  userId: 'usr-002' },
];
