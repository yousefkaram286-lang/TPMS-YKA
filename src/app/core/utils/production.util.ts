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
   * Sums the durations of a set of downtime events. Non-finite/negative
   * individual durations are treated as 0. Always returns >= 0.
   */
  static sumDowntime(events: Array<{ durationMinutes?: number | null }> | null | undefined): number {
    if (!events || events.length === 0) return 0;
    return events.reduce((total, e) => {
      const d = Number(e?.durationMinutes) || 0;
      return total + (Number.isFinite(d) && d > 0 ? d : 0);
    }, 0);
  }

  /**
   * Base available minutes per Line per Day (6.5-hour shift).
   */
  static readonly BASE_AVAILABLE_MINUTES = 390;

  /**
   * Available time in minutes = BASE + OvertimeMinutes.
   * Overtime is provided in hours (UI + storage authority) and converted
   * internally to minutes so the stored/reporting value stays unambiguous.
   */
  static availableMinutes(overtimeHours: number | undefined | null): number {
    const ot = Number(overtimeHours) || 0;
    const safeOt = Number.isFinite(ot) && ot > 0 ? ot : 0;
    return this.BASE_AVAILABLE_MINUTES + (safeOt * 60);
  }

  /**
   * Actual run time = max(0, Available - TotalDowntime).
   */
  static actualRunMinutes(
    overtimeHours: number | undefined | null,
    downtimeEvents: Array<{ durationMinutes?: number | null }> | null | undefined
  ): number {
    return Math.max(0, this.availableMinutes(overtimeHours) - this.sumDowntime(downtimeEvents));
  }

  /**
   * Efficiency = Actual / Available * 100, or 0 when Available <= 0.
   */
  static efficiencyPercent(
    overtimeHours: number | undefined | null,
    downtimeEvents: Array<{ durationMinutes?: number | null }> | null | undefined
  ): number {
    const available = this.availableMinutes(overtimeHours);
    if (available <= 0) return 0;
    const actual = this.actualRunMinutes(overtimeHours, downtimeEvents);
    return (actual / available) * 100;
  }

  /**
   * Resolves the display scalar downtime for a session: a new session's
   * downtimeEvents are summed; a historical scalar-only session falls back to
   * the legacy per-line downtimeMinutes aggregate.
   */
  static downtimeMinutesOf(session: {
    downtimeEvents?: Array<{ durationMinutes?: number | null }> | null;
    dailyLineTime?: Array<{ downtimeMinutes?: number | null }> | null;
  } | null | undefined): number {
    if (!session) return 0;
    if (session.downtimeEvents && session.downtimeEvents.length > 0) {
      return this.sumDowntime(session.downtimeEvents);
    }
    return (session.dailyLineTime || []).reduce(
      (total, e) => total + (Number(e?.downtimeMinutes) || 0),
      0
    );
  }

  /**
   * EDIT/READ compatibility transformation (NOT a data migration): returns the
   * downtime events to display in the edit form.
   *
   *  - If the session has real granular downtimeEvents, those are returned as-is.
   *  - Otherwise, if legacy dailyLineTime[0].downtimeMinutes > 0, ONE
   *    compatibility event is synthesized so historical downtime is never
   *    silently shown as zero or lost on a later Save.
   *  - Otherwise an empty array (no downtime to edit).
   */
  static legacyDowntimeEvents(session: {
    downtimeEvents?: Array<{ durationMinutes?: number | null; reason?: string | null; notes?: string | null }> | null;
    dailyLineTime?: Array<{ downtimeMinutes?: number | null; downtimeReason?: string | null; notes?: string | null }> | null;
  } | null | undefined): Array<{ durationMinutes: number; reason: string; notes: string }> {
    if (!session) return [];
    if (session.downtimeEvents && session.downtimeEvents.length > 0) {
      return session.downtimeEvents.map(ev => ({
        durationMinutes: Number(ev.durationMinutes) || 0,
        reason: (ev.reason || '').trim(),
        notes: (ev.notes || '').trim()
      }));
    }
    if (session.dailyLineTime && session.dailyLineTime.length > 0) {
      const lt = session.dailyLineTime[0];
      const legacyMinutes = Number(lt.downtimeMinutes) || 0;
      if (legacyMinutes > 0) {
        return [{
          durationMinutes: legacyMinutes,
          reason: (lt.downtimeReason || '').trim(),
          notes: (lt.notes || '').trim()
        }];
      }
    }
    return [];
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