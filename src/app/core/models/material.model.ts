export interface Material {
  id: string;
  name: string;
  unit: string;
  conversionKgPerM3?: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}
