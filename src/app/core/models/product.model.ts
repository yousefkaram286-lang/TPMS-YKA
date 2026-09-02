export type ProductType = 'SOLID' | 'BLOCK';

export interface Product {
  id: string;
  name: string;
  // Optional Arabic display name (factory-facing label).
  nameAr?: string;
  // Product family — SOLID (مصمت) vs BLOCK (بلوك). Configurable, never derived from the name.
  type?: ProductType;
  piecesPerPress?: number;
  // Bearing area in factory field units (cm² for the verified Toblat products).
  productArea?: number;
  // Compression Standard (kg/cm² field unit). Stored per product — NEVER computed from the name.
  standardStrength: number;
  // Quality standard dimensions (configurable, never fabricated when missing).
  standardHeight?: number;
  standardWeight?: number;
  // Display-only nominal dimensions (e.g. "40 × 20 × 25 cm").
  dimensions?: string;
  // Optional nominal density (kg/m³) — informational only, not used by production/quality.
  densityKgPerM3?: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}
