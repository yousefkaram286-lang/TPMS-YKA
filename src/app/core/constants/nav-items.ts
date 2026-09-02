// ============================================================
// TPMS — Navigation Constants
// ============================================================
import { NavItem } from '../models/nav-item.model';

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
  },
  {
    id: 'production',
    label: 'Production',
    icon: 'precision_manufacturing',
    route: '/production',
    roles: ['Admin'],
  },
  {
    id: 'output-release',
    label: 'Output Release',
    icon: 'output',
    route: '/output-release',
    roles: ['Admin'],
  },
  {
    id: 'materials',
    label: 'Materials',
    icon: 'inventory_2',
    route: '/materials',
    roles: ['Admin'],
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: 'verified',
    route: '/quality',
    roles: ['Admin'],
  },
  {
    id: 'users',
    label: 'Users',
    icon: 'group',
    route: '/users',
    roles: ['Admin'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    route: '/settings',
    roles: ['Admin'],
  },
];
