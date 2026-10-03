// ============================================================
// TPMS — Trolley Input Utility (Production Line 1 & Line 2)
// ------------------------------------------------------------
// Factory-confirmed business rule:
//
//   Line 1 and Line 2 do NOT receive direct Presses input.
//   The operator enters TROLLEYS and the system derives Presses:
//
//        Presses = Trolleys x PRESSES_PER_TROLLEY
//        Produced = Presses x PiecesPerPress
//
//   1 Trolley = 14 Presses (fixed, not configurable).
//
//   Presses must ALWAYS be a whole number.
//
// HALF-TROLLEY STEP
//   The operator enters trolley values in increments of 0.5 Trolley.
//   Because 0.5 Trolley = 7 Presses, a multiple of 0.5 Trolley always
//   yields a whole number of Presses — which is exactly the guarantee the
//   factory asked for.
//
//        Trolleys   Presses   Result
//        0          0         VALID   (line stopped, zero production)
//        0.5        7         VALID
//        1          14        VALID
//        1.5        21        VALID
//        30         420       VALID
//        30.5       427       VALID
//
//        0.25       3.5       INVALID
//        0.75       10.5      INVALID
//        1.25       17.5      INVALID
//        30.25      423.5     INVALID
//
//   An invalid value is REJECTED, never floored, ceiled, rounded, or
//   silently snapped to the nearest 0.5 (30.25 is NOT quietly saved as
//   30.5 or 30). The operator is shown a clear validation message.
//
//   ZERO stays VALID and savable: a line stopped for the whole operational
//   day is a real zero-production session.
//
//   Produced is deliberately NOT constrained to a whole number, because
//   PiecesPerPress may itself be fractional (e.g. 427 presses x 10.5
//   = 4483.5 pieces).
//
// SCOPE: applies ONLY to the trolley lines listed in TROLLEY_LINE_IDS.
// Every other line keeps the existing manual Presses input untouched.
// ============================================================

/**
 * Lines that receive Trolley input instead of direct Presses input.
 * Identified by the master-data Line id (NOT by display name) so a
 * renamed line keeps — or loses — trolley mode deterministically.
 */
export const TROLLEY_LINE_IDS: ReadonlySet<string> = new Set(['lin-001', 'lin-002']);

/** Fixed factory conversion factor: 1 Trolley = 14 Presses. */
export const PRESSES_PER_TROLLEY = 14;

/**
 * Entry increment for the Trolley Count field: 0.5 Trolley.
 * Used for the input's `step` attribute, and mirrors the validation rule so
 * the UI affordance and the accepted values can never disagree.
 */
export const TROLLEY_STEP = 0.5;

/** Presses produced by one half-trolley increment: 0.5 x 14 = 7. */
export const PRESSES_PER_HALF_TROLLEY = TROLLEY_STEP * PRESSES_PER_TROLLEY;

export class TrolleyUtil {
  /**
   * True when the given Line id receives Trolley input.
   * An unknown/empty line id is NOT a trolley line.
   */
  static isTrolleyLine(lineId: string | null | undefined): boolean {
    return !!lineId && TROLLEY_LINE_IDS.has(lineId);
  }

  /**
   * Converts a Trolley count to Presses.
   *
   * The result is the exact product Trolleys x 14. It is NEVER floored, ceiled
   * or rounded: when that product is fractional the entry is invalid and the
   * validator reports it, so the operator sees the real reason instead of a
   * silently altered number. Callers that need a guaranteed-whole value must
   * check `isValidTrolleyCount` first.
   *
   * Returns 0 for non-finite input and for the null "not entered" state.
   * A trolley count of 0 is a legitimate entry and yields 0 presses.
   */
  static calculatePresses(trolleyCount: unknown): number {
    if (!this.isNumericTrolleyCount(trolleyCount)) return 0;
    return Number(trolleyCount) * PRESSES_PER_TROLLEY;
  }

  /**
   * True when the Trolley count sits on a valid 0.5-Trolley increment.
   *
   * Mathematically this is "Trolleys x 2 is a whole number". The test is done
   * in exact decimal arithmetic (BigInt numerator over a power-of-ten
   * denominator) rather than on the raw IEEE-754 product, so a legitimate
   * value is never rejected because of binary-floating-point noise and an
   * illegitimate one is never accepted because of it.
   */
  static isOnStep(trolleyCount: unknown): boolean {
    if (!this.isNumericTrolleyCount(trolleyCount)) return false;
    const fraction = this.exactFraction(Number(trolleyCount));
    if (!fraction) return false;
    // Multiple of 0.5 <=> doubling the value is a whole number.
    return (fraction.num * 2n) % fraction.den === 0n;
  }

  /**
   * True when Trolleys x 14 is a whole number of Presses.
   *
   * Retained as a named check because "whole Presses" is the business
   * guarantee. Every multiple of 0.5 Trolley satisfies it (0.5 x 14 = 7), so
   * this is true for exactly the same values as `isOnStep`; the two are kept
   * separate so the rule is expressed in the terms the factory used.
   */
  static hasWholePresses(trolleyCount: unknown): boolean {
    return this.isOnStep(trolleyCount);
  }

  /**
   * True when the value is a usable numeric trolley count: finite, and >= 0.
   * Zero is allowed on purpose — a stopped line is a real production entry.
   * Expressed as a string it must be a plain decimal (no exponent-only, no
   * trailing garbage, no empty string).
   */
  static isNumericTrolleyCount(trolleyCount: unknown): boolean {
    if (typeof trolleyCount === 'number') return Number.isFinite(trolleyCount) && trolleyCount >= 0;
    if (typeof trolleyCount !== 'string') return false;
    const trimmed = trolleyCount.trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return false;
    return Number.isFinite(Number(trimmed));
  }

  /**
   * Trolley validation. A trolley count is valid when it is numeric, >= 0, and
   * a multiple of 0.5 Trolley — which guarantees a whole number of Presses.
   *
   *   0, 0.5, 1, 1.5, 30, 30.5      valid
   *   0.25, 0.75, 1.25, 30.25       invalid — not a multiple of 0.5
   *   -2, 'bad'                     invalid
   *
   * Invalid values are rejected, never rounded or snapped to the nearest
   * allowed increment.
   *
   * Accepts `unknown` because an Angular number control yields a number, a raw
   * DOM string, or null depending on how the value was entered; all three are
   * validated on their numeric result.
   */
  static isValidTrolleyCount(trolleyCount: unknown): boolean {
    if (!this.isNumericTrolleyCount(trolleyCount)) return false;
    return this.isOnStep(trolleyCount);
  }

  /**
   * Exact decimal fraction of a finite non-negative number, as BigInt
   * numerator / denominator, e.g. 30.5 -> 305n / 10n and 0.25 -> 25n / 100n.
   *
   * Built from the number's shortest round-trip decimal representation, so it
   * reflects the value the operator actually entered instead of binary-float
   * noise, and it imposes no artificial cap on the number of decimal places.
   * Returns null when the value cannot be expressed as a plain decimal.
   */
  private static exactFraction(value: number): { num: bigint; den: bigint } | null {
    if (!Number.isFinite(value)) return null;
    const match = /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(value));
    if (!match) return null;

    const intPart = match[1];
    const fracPart = match[2] ?? '';
    const exponent = match[3] ? parseInt(match[3], 10) : 0;
    let num = BigInt(intPart + fracPart);
    let scale = fracPart.length - exponent;
    if (scale < 0) {
      num *= 10n ** BigInt(-scale);
      scale = 0;
    }
    return { num, den: 10n ** BigInt(scale) };
  }

  /**
   * Historical-integrity helper.
   *
   * A Trolley count is only ever read from — or written to — a record that
   * ALREADY carries one. A missing value stays missing: no trolley count is
   * ever back-derived from a legacy Presses value, because a legacy Presses
   * figure is not guaranteed to have originated from whole or partial trolleys.
   */
  static trolleyCountOf(record: { trolleyCount?: number | null } | null | undefined): number | null {
    if (!record) return null;
    const raw = record.trolleyCount;
    if (raw === null || raw === undefined) return null;
    const value = Number(raw);
    // 0 is a REAL stored trolley count (stopped line), so it is preserved and
    // must not be collapsed into "no trolley data". Only a negative or
    // non-numeric value is treated as absent.
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  /**
   * True when the record was captured through the Trolley flow, i.e. it has a
   * stored trolley count. Used to decide whether a Line 1/2 record can be
   * re-opened in trolley mode without inventing data.
   */
  static hasTrolleyData(record: { trolleyCount?: number | null } | null | undefined): boolean {
    return this.trolleyCountOf(record) !== null;
  }
}
