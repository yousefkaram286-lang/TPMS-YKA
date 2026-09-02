export class ProductionUtil {
  static calculateProduced(piecesPerPress: number, presses: number): number {
    const pieces = Number(piecesPerPress) || 0;
    const count = Number(presses) || 0;
    if (!Number.isFinite(pieces) || !Number.isFinite(count)) return 0;
    return Math.round(pieces * count * 1e6) / 1e6;
  }

  static isConfigured(piecesPerPress: number | undefined | null): boolean {
    return (
      typeof piecesPerPress === 'number' &&
      Number.isFinite(piecesPerPress) &&
      piecesPerPress > 0
    );
  }

  static isValidPressCount(presses: number | undefined | null): boolean {
    return (
      typeof presses === 'number' &&
      Number.isFinite(presses) &&
      presses >= 0
    );
  }

  /**
   * Historical-integrity rule for Product references on Production save.
   *
   * CURRENT MASTER DATA controls NEW/CHANGED transactions; HISTORICAL
   * SNAPSHOTS control EXISTING historical transactions:
   *
   * - CREATE, and any reference that is NEW or SWITCHED to a different
   *   Product, MUST target a Product that exists and is ACTIVE.
   * - An UNCHANGED existing item whose Product has since been deactivated
   *   remains valid — Historical Product references are never forced to
   *   satisfy today's active status.
   * - A missing Product is ALWAYS blocked (a reference is never silently
   *   re-pointed elsewhere).
   */
  static resolveProductReferenceStatus(input: {
    editing: boolean;
    existingProductId: string | undefined;
    nextProductId: string;
    productExists: boolean;
    productActive: boolean;
  }): 'ok' | 'blocked' {
    if (!input.productExists) return 'blocked';
    if (input.productActive) return 'ok';
    const unchangedHistoricalReference =
      input.editing &&
      input.existingProductId !== undefined &&
      input.existingProductId === input.nextProductId;
    return unchangedHistoricalReference ? 'ok' : 'blocked';
  }
}

export class SubmissionGuard {
  private active = false;

  acquire(): boolean {
    if (this.active) return false;
    this.active = true;
    return true;
  }

  release(): void {
    this.active = false;
  }

  get isActive(): boolean {
    return this.active;
  }
}