export interface UnitCost {
  id: string;
  materialId: string;
  unitCost: number;
  unit: string;
  createdAt: string;
  updatedAt?: string;
  /** TRUE for pre-loaded demo values that are NOT business-confirmed. */
  demo?: boolean;
}
