export type QualityCompressionResult = 'PASS' | 'FAIL' | 'CONFIGURATION_REQUIRED';

/**
 * One independent physical measurement within a three-sample Quality test.
 * Actual values are user-entered; standard values and Area/Compression are
 * snapshots taken from the Product Master AT SAVE TIME (never recomputed).
 */
export interface QualitySample {
  sampleNumber: number;
  actualHeight: number;
  actualWeight: number;
  load: number;
  compression: number;
  compressionResult: QualityCompressionResult;
  heightDifference?: number;
  weightDifference?: number;
}

export interface QualityTest {
  id: string;
  date: string;
  productId: string;
  productName: string;
  lineId?: string;
  lineName?: string;
  testDate: string;
  // Test-level snapshots from the Product Master at save time (historical integrity).
  productAreaSnapshot?: number;
  compressionStandardSnapshot?: number;
  standardHeightSnapshot?: number;
  standardWeightSnapshot?: number;
  // Optional production traceability (never required).
  productionRecordId?: string;
  productionDate?: string;
  notes?: string;
  submissionId?: string;
  // Exactly 3 sampling events for the Line/Product test (confirmed workflow).
  samples?: QualitySample[];
  // Legacy single-measurement fields kept for pre-three-sample records.
  strength?: number;
  standardStrength?: number;
  load?: number;
  compression?: number;
  sample?: string;
  result?: 'PASS' | 'FAIL' | 'PENDING' | 'CONFIGURATION_REQUIRED';
  decisionSource?: 'LEGACY_AUTO_CALCULATED' | 'MANUAL' | 'PENDING_NOT_ASSESSED' | 'AUTO_CALCULATED';
  createdAt: string;
  updatedAt?: string;
}