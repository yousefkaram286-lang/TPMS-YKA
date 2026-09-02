// ============================================================
// TPMS — Output Release Model
// ============================================================

/**
 * Represents a physical release of concrete product from the
 * post-production / high-humidity stage to finished goods.
 *
 * IMPORTANT: Production and Output/Release are INDEPENDENT transactions.
 * There is NO Production→Release batch traceability in the current system.
 *
 * Legacy data migrated from ProductionSession.releasedOutput will carry
 * dataSource = 'LEGACY_AMBIGUOUS_SESSION' and will NOT have a productId,
 * because a session can span multiple Production rows with different products.
 */
export interface OutputRelease {
  id: string;                      // deterministic: 'migrated_session_<sessionId>' for legacy; UUID for new entries
  releaseDate: string;             // YYYY-MM-DD — date the quantity was physically released

  /**
   * lineId is preserved when it was reliably known on the source session.
   * For legacy migrated records this comes directly from ProductionSession.lineId.
   * May be undefined if the source record lacked it.
   */
  lineId?: string;

  /**
   * productId is intentionally left undefined for legacy migrated records.
   * A ProductionSession can contain Production rows for multiple products,
   * so we CANNOT attribute releasedOutput to a specific product without
   * introducing false traceability.
   * Only new manual entries (MANUAL_ENTRY) may carry a known productId.
   */
  productId?: string;

  releasedQuantity: number;

  /**
   * Provenance marker — how this record was created.
   *
   * LEGACY_AMBIGUOUS_SESSION — migrated from ProductionSession.releasedOutput.
   *   productId is undefined; lineId is preserved if reliably known.
   *   These records must NOT be presented as editable manual entries.
   *
   * MANUAL_ENTRY — entered by a user via the Output Release UI.
   *   productId and lineId may be supplied if known at release time.
   *   No Production→Output traceability is implied or created.
   */
  dataSource: 'LEGACY_AMBIGUOUS_SESSION' | 'MANUAL_ENTRY';

  /**
   * For LEGACY_AMBIGUOUS_SESSION records only.
   * Links back to the original ProductionSession for audit/debugging purposes.
   * This is NOT a production→output traceability link; it is a migration provenance link.
   */
  legacySessionId?: string;

  notes?: string;
  createdAt: string;
  updatedAt?: string;
}
