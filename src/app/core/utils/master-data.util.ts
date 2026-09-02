import { Product, ProductType } from '../models/product.model';
import { Material } from '../models/material.model';

export class MasterDataUtil {
  static piecesPerPressOf(product: Product | undefined | null): number | undefined {
    return product?.piecesPerPress;
  }

  static productAreaOf(product: Product | undefined | null): number | undefined {
    return product?.productArea;
  }

  static compressionStandardOf(product: Product | undefined | null): number | undefined {
    if (product && typeof product.standardStrength === 'number') {
      return product.standardStrength;
    }
    return undefined;
  }

  static standardHeightOf(product: Product | undefined | null): number | undefined {
    return product?.standardHeight;
  }

  static standardWeightOf(product: Product | undefined | null): number | undefined {
    return product?.standardWeight;
  }

  /** Product family: SOLID (مصمت) vs BLOCK (بلوك). Never derived from the product name. */
  static productTypeOf(product: Product | undefined | null): ProductType | undefined {
    return product?.type;
  }

  /** Display-only nominal dimensions (e.g. "40 × 20 × 25 cm"). */
  static productDimensionsOf(product: Product | undefined | null): string | undefined {
    return product?.dimensions;
  }

  /** Optional nominal density (kg/m³) — informational only. */
  static densityKgPerM3Of(product: Product | undefined | null): number | undefined {
    return product?.densityKgPerM3;
  }

  /** True when the value is a finite configured positive number. */
  static isConfiguredPositive(value: number | undefined | null): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  static conversionKgPerM3Of(material: Material | undefined | null): number | undefined {
    return material?.conversionKgPerM3;
  }

  static isConfiguredConversion(kgPerM3: number | undefined | null): boolean {
    return typeof kgPerM3 === 'number' && Number.isFinite(kgPerM3) && kgPerM3 > 0;
  }
}