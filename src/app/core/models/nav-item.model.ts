// ============================================================
// TPMS — Navigation Item Model
// ============================================================

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  roles?: ('Admin' | 'User')[];
  badge?: string | number;
  children?: NavItem[];
}
