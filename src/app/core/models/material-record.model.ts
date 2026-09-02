export interface MaterialTransactionItem {
  /**
   * Resolved master id for the canonical material ('' when no master record
   * matches the name). Actual quantities never depend on this id.
   */
  materialId: string;

  /** Canonical name: Cement | Sand | Aggregate | Water. */
  materialName: string;

  /** Operational unit: 'kg' for Cement/Sand/Aggregate, 'L' for Water. */
  unit: string;

  /**
   * STANDARD recipe quantity per mix (kg/Mix or L/Mix) — reference snapshot
   * only. Copied from the Product's recipe at entry time; never overrides
   * perMixActual, and later Recipe master changes do not touch it.
   */
  perMixStandard: number;

  /**
   * ACTUAL quantity per mix (kg/Mix or L/Mix), entered by the operator.
   * The authoritative input for the corrected materials model.
   */
  perMixActual: number;

  /** Reference daily standard = perMixStandard × mixCount. */
  theoreticalQuantity: number;

  /**
   * CALCULATED DAILY ACTUAL TOTAL = perMixActual × mixCount.
   * This is the authoritative daily consumption for the Line.
   */
  actualQuantity: number;

  /** Variance = actualQuantity − theoreticalQuantity. */
  variance: number;

  /**
   * True when the configured unit cost is dimension-compatible with the
   * operational unit (kg or L) — either identical or an exact metric
   * conversion (ton→kg, m³→L). False → cost is deferred, unitCost = 0.
   */
  dimensionOk: boolean;

  /** Effective price per operational unit after explicit conversion; 0 when !dimensionOk. */
  unitCost: number;

  /** Cost = actualQuantity × unitCost; 0 when !dimensionOk (deferred, warning shown). */
  totalCost: number;
}

export interface MaterialRecord {
  /** Deterministic id: material_sub_<submissionId>. */
  id: string;

  /** Local plant calendar date (YYYY-MM-DD, never UTC-shifted). */
  date: string;

  /** Transaction grain: production Line. Required. */
  lineId: string;

  /** Optional metadata. */
  shiftId?: string;

  /** Optional metadata — Product is NOT required to compute Line/day usage. */
  productId?: string;

  /** Total number of mixer batches/mixes for the Line/day. Required, > 0. */
  mixCount: number;

  materials: MaterialTransactionItem[];
  totalCost: number;

  operator?: string;
  notes?: string;

  createdAt: string;
  updatedAt?: string;
}