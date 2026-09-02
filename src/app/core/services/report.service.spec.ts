import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx';

import { ReportService, ReportParams } from './report.service';
import { DateRange } from './dashboard.service';

import { Production } from '../models/production.model';
import { ProductionSession } from '../models/production-session.model';
import { MaterialRecord, MaterialTransactionItem } from '../models/material-record.model';
import { QualityTest, QualitySample } from '../models/quality-test.model';
import { OutputRelease } from '../models/output-release.model';
import { Product } from '../models/product.model';
import { Shift } from '../models/shift.model';
import { Line } from '../models/line.model';
import { Material } from '../models/material.model';
import { UnitCost } from '../models/unit-cost.model';
import { EfficiencyUtil } from '../utils/efficiency.util';
import { QualityCalculationUtil } from '../utils/quality-calculation.util';
import { CONFIGURATION_REQUIRED } from '../utils/material-conversion.util';

// ─── Seeds ────────────────────────────────────────────────────────────────────

const NOW = '2026-08-29T08:00:00.000Z';
const TODAY = '2026-08-29';

const PRODUCTS: Product[] = [
  { id: 'prd-a', name: 'Block 20', productArea: 0.2, standardStrength: 15, standardHeight: 200, standardWeight: 99, active: true, createdAt: NOW },
  { id: 'prd-b', name: 'Block 15', productArea: 0.2, standardStrength: 12, standardHeight: 200, standardWeight: 99, active: true, createdAt: NOW }
];

const LINES: Line[] = [
  { id: 'lin-1', name: 'Line 1 - Heavy', active: true, createdAt: NOW },
  { id: 'lin-2', name: 'Line 2 - Standard', active: true, createdAt: NOW }
];

const SHIFTS: Shift[] = [{ id: 'shift-1', name: 'Day', startTime: '07:00', endTime: '15:00', active: true, createdAt: NOW }];

const MASTER_MATERIALS: Material[] = [
  { id: 'mat-sand', name: 'Sand', unit: 'kg', conversionKgPerM3: 1600, active: true, createdAt: NOW },
  { id: 'mat-agg',  name: 'Aggregate', unit: 'kg', conversionKgPerM3: 1400, active: true, createdAt: NOW },
  { id: 'mat-cement', name: 'Cement', unit: 'kg', active: true, createdAt: NOW }
];

const MASTER_NO_SAND: Material[] = MASTER_MATERIALS.filter(m => m.name !== 'Sand');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProduction(overrides: Partial<Production> = {}): Production {
  return {
    id: 'prod-1', sessionId: 'sess-1', date: TODAY, shiftId: 'shift-1', lineId: 'lin-1',
    supervisor: 'Op', productId: 'prd-a', piecesPerPress: 8, presses: 10, produced: 80,
    createdAt: NOW, ...overrides
  };
}

function makeSample(overrides: Partial<QualitySample> = {}): QualitySample {
  const evaluation = QualityCalculationUtil.evaluateSample(3.2, 0.2, 15);
  return {
    sampleNumber: 1, actualHeight: 200, actualWeight: 100, load: 3.2,
    compression: evaluation.compression as number,
    compressionResult: evaluation.compressionResult,
    heightDifference: QualityCalculationUtil.heightDifference(200, 200),
    weightDifference: QualityCalculationUtil.weightDifference(100, 99),
    ...overrides
  };
}

function makeQuality(overrides: Partial<QualityTest> = {}): QualityTest {
  return {
    id: 'qt-1', date: TODAY, productId: 'prd-a', productName: 'Block 20',
    lineId: 'lin-1', lineName: 'Line 1 - Heavy', testDate: TODAY,
    productAreaSnapshot: 0.2, compressionStandardSnapshot: 15,
    standardHeightSnapshot: 200, standardWeightSnapshot: 99,
    samples: [
      makeSample({ sampleNumber: 1, load: 3.2 }),
      makeSample({ sampleNumber: 2, load: 3.2 }),
      makeSample({ sampleNumber: 3, load: 3.2 })
    ],
    decisionSource: 'AUTO_CALCULATED', createdAt: NOW, ...overrides
  };
}

function makeLegacyQuality(overrides: Partial<QualityTest> = {}): QualityTest {
  return {
    id: 'qt-legacy', date: TODAY, productId: 'prd-a', productName: 'Block 20',
    testDate: TODAY, load: 3.1, strength: 15.5, standardStrength: 15,
    sample: 'Sample A', result: 'FAIL', decisionSource: 'LEGACY_AUTO_CALCULATED',
    createdAt: NOW, ...overrides
  };
}

function makeMaterial(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
  const items: MaterialTransactionItem[] = [
    { materialId: 'mat-cement', materialName: 'Cement', unit: 'kg', perMixStandard: 0, perMixActual: 210, theoreticalQuantity: 0, actualQuantity: 4200, variance: 0, dimensionOk: true, unitCost: 0.05, totalCost: 210 },
    { materialId: 'mat-sand', materialName: 'Sand', unit: 'kg', perMixStandard: 0, perMixActual: 380, theoreticalQuantity: 0, actualQuantity: 7600, variance: 0, dimensionOk: true, unitCost: 0.03, totalCost: 228 },
    { materialId: 'mat-agg', materialName: 'Aggregate', unit: 'kg', perMixStandard: 0, perMixActual: 515, theoreticalQuantity: 0, actualQuantity: 10300, variance: 0, dimensionOk: true, unitCost: 0.04, totalCost: 412 },
    { materialId: '', materialName: 'Water', unit: 'L', perMixStandard: 0, perMixActual: 95, theoreticalQuantity: 0, actualQuantity: 1900, variance: 0, dimensionOk: true, unitCost: 0.01, totalCost: 19 }
  ];
  return {
    id: 'mat-1', date: TODAY, lineId: 'lin-1', productId: 'prd-a', mixCount: 20,
    materials: items.map(i => ({ ...i })), totalCost: 869, createdAt: NOW, ...overrides
  };
}

function makeRelease(overrides: Partial<OutputRelease> = {}): OutputRelease {
  return {
    id: 'rel-1', releaseDate: TODAY, lineId: 'lin-1', productId: 'prd-b',
    releasedQuantity: 500, dataSource: 'MANUAL_ENTRY', createdAt: NOW, ...overrides
  };
}

function makeSession(overrides: Partial<ProductionSession> = {}): ProductionSession {
  return {
    id: 'sess-1', date: TODAY, shiftId: 'shift-1', lineId: 'lin-1', supervisor: 'Op',
    overtime: false, overtimeHours: 0,
    dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 0, downtimeMinutes: 30, downtimeReason: '', notes: '' }],
    notes: '', createdAt: NOW, ...overrides
  };
}

const TODAY_RANGE: DateRange = { preset: 'today', startDate: TODAY, endDate: TODAY, label: 'Today' };

function buildParams(overrides: Partial<ReportParams> = {}): ReportParams {
  return {
    type: 'daily',
    format: 'xlsx',
    range: TODAY_RANGE,
    productions: [],
    sessions: [],
    materials: [],
    qualityTests: [],
    releases: [],
    products: PRODUCTS,
    shifts: SHIFTS,
    lines: LINES,
    materialsMaster: MASTER_MATERIALS,
    unitCostsMaster: [],
    ...overrides
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach((v: any) => deepFreeze(v));
  }
  return value;
}

function rowsOf(ws: XLSX.WorkSheet): any[][] {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
  return rows.map(r => {
    let last = r.length - 1;
    while (last >= 0 && (r[last] === '' || r[last] === undefined || r[last] === null)) {
      last--;
    }
    return last < 0 ? [] : r.slice(0, last + 1);
  });
}

/** Returns all rows of a sheet section (skipping the section title and headers). */
function section(ws: XLSX.WorkSheet, title: string): any[][] {
  const rs = rowsOf(ws);
  const start = rs.findIndex(r => r[0] === title);
  if (start < 0) return [];
  const out: any[][] = [];
  for (let i = start + 1; i < rs.length; i++) {
    const r = rs[i];
    const isEmpty = r.every(v => v === '' || v === undefined);
    if (isEmpty) break;
    if (typeof r[0] === 'string' && r[0] === r[0].toUpperCase() && r.slice(1).every(v => v === '' || v === undefined) && r[0] !== 'TOTAL') {
      break;
    }
    out.push(r);
  }
  return out;
}

/** Value cell directly beneath a KPI label cell (exWriteKpiRow layout). */
function kpi(ws: XLSX.WorkSheet, label: string): any {
  const rs = rowsOf(ws);
  for (let i = 0; i < rs.length; i++) {
    for (let c = 0; c < rs[i].length; c++) {
      if (rs[i][c] === label) {
        return rs[i + 1] ? rs[i + 1][c] : undefined;
      }
    }
  }
  return undefined;
}

// ─── Test Bed ────────────────────────────────────────────────────────────────

describe('ReportService', () => {
  let svc: ReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ReportService] });
    svc = TestBed.inject(ReportService);
  });

  const dailySheet = (p: Partial<ReportParams>) => {
    const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'daily', ...p }));
    return wb.Sheets['Daily Operational'] as XLSX.WorkSheet;
  };

  const monthlySheet = (p: Partial<ReportParams>) => {
    const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'monthly', ...p }));
    return wb.Sheets['Monthly Operational'] as XLSX.WorkSheet;
  };

  // ═══════════ DAILY REGRESSIONS (1–17) ═══════════

  describe('DAILY REPORT', () => {

    it('01. daily workbook contains a "Daily Operational" sheet', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'daily' }));
      expect(wb.Sheets['Daily Operational']).toBeDefined();
    });

    it('02. daily sheet header title is "DAILY OPERATIONAL REPORT"', () => {
      const ws = dailySheet({ type: 'daily' });
      expect(rowsOf(ws)[3][0]).toBe('DAILY OPERATIONAL REPORT');
    });

    it('03. KPI "Total Presses" sums production presses', () => {
      const ws = dailySheet({
        productions: [makeProduction({ presses: 10 }), makeProduction({ id: 'p2', presses: 5, produced: 40 })]
      });
      expect(kpi(ws, 'Total Presses')).toBe(15);
    });

    it('04. KPI "Press Production" sums produced quantity', () => {
      const ws = dailySheet({
        productions: [makeProduction({ presses: 10, produced: 80 }), makeProduction({ id: 'p2', presses: 5, produced: 40 })]
      });
      expect(kpi(ws, 'Press Production')).toBe(120);
    });

    it('05. KPI "Released Output" comes from Output Releases (independent, not prod.releasedOutput)', () => {
      const ws = dailySheet({
        productions: [makeProduction({ releasedOutput: 50 })],
        releases: [
          makeRelease({ releasedQuantity: 500 }),
          makeRelease({ id: 'rel-2', productId: undefined, dataSource: 'LEGACY_AMBIGUOUS_SESSION', releasedQuantity: 300 })
        ]
      });
      expect(kpi(ws, 'Released Output')).toBe(800);
    });

    it('06. product breakdown aggregates the same product and labels legacy releases "Unattributed Release"', () => {
      const ws = dailySheet({
        productions: [
          makeProduction({ presses: 10, produced: 80 }),
          makeProduction({ id: 'p2', presses: 20, produced: 160 })
        ],
        releases: [makeRelease({ id: 'rel-2', productId: undefined, dataSource: 'LEGACY_AMBIGUOUS_SESSION', releasedQuantity: 300 })]
      });
      const rows = section(ws, 'PRODUCTION BY PRODUCT (INDEPENDENT OF RELEASES)').slice(1);
      expect(rows).toEqual([
        ['Unattributed Release', 0, 0, 300],
        ['Block 20', 30, 240, 0]
      ]);
    });

    it('07. released output is attributed to its own product row, not production', () => {
      const ws = dailySheet({
        productions: [makeProduction({ productId: 'prd-a' })],
        releases: [makeRelease({ productId: 'prd-b', releasedQuantity: 500 })]
      });
      const rows = section(ws, 'PRODUCTION BY PRODUCT (INDEPENDENT OF RELEASES)').slice(1);
      const block20 = rows.find(r => r[0] === 'Block 20');
      const block15 = rows.find(r => r[0] === 'Block 15');
      expect(block20).toEqual(['Block 20', 10, 80, 0]);
      expect(block15).toEqual(['Block 15', 0, 0, 500]);
    });

    it('08. line-level operations aggregate presses, produced, released, mix count and downtime', () => {
      const ws = dailySheet({
        productions: [makeProduction({ presses: 10, produced: 80 })],
        releases: [makeRelease({ releasedQuantity: 500 })],
        materials: [makeMaterial()],
        sessions: [makeSession()]
      });
      const row = section(ws, 'LINE-LEVEL OPERATIONS')[1];
      expect(row[0]).toBe('Line 1 - Heavy');
      expect(row[1]).toBe('Block 20'); // Pressed Product(s)
      expect(row[2]).toBe('Block 15'); // Released Product(s)
      expect(row[4]).toBe(10); // Presses
      expect(row[5]).toBe(80); // Produced
      expect(row[6]).toBe(500); // Released
      expect(row[7]).toBe(20); // Mix Count
      expect(row[8]).toBe(4200); // Cement kg
      expect(row[9]).toBe(4.75); // Sand m³ = 7600 / 1600
      expect(row[12]).toBe(30); // Downtime
    });

    it('09. multi-product lines show a full product breakdown', () => {
      const ws = dailySheet({
        productions: [
          makeProduction({ productId: 'prd-a' }),
          makeProduction({ id: 'p2', productId: 'prd-b', presses: 20, produced: 160 })
        ]
      });
      const row = section(ws, 'LINE-LEVEL OPERATIONS')[1];
      expect(row[1]).toContain('Block 20');
      expect(row[1]).toContain('Block 15');
      expect(row[2]).toBe('—'); // no releases → Released Product(s) empty
      const ops = (svc as any).buildLineOperations(buildParams({
        productions: [makeProduction({ productId: 'prd-a' }), makeProduction({ id: 'p2', productId: 'prd-b', presses: 20, produced: 160 })]
      }));
      expect(ops[0].products.map((pd: any) => pd.productName)).toEqual(['Block 15', 'Block 20']);
    });

    it('09b. pressed and released products are reported in separate columns', () => {
      const ws = dailySheet({
        productions: [makeProduction()],                                     // Block 20 pressed
        releases: [makeRelease({ productId: 'prd-b', releasedQuantity: 500 })] // Block 15 released
      });
      const row = section(ws, 'LINE-LEVEL OPERATIONS')[1];
      expect(row[1]).toBe('Block 20'); // Pressed Product(s)
      expect(row[2]).toBe('Block 15'); // Released Product(s)
      // a product pressed AND released the same line/day appears in both labels
      const both = dailySheet({
        productions: [makeProduction()],
        releases: [makeRelease({ productId: 'prd-a', releasedQuantity: 700 })]
      });
      const rowBoth = section(both, 'LINE-LEVEL OPERATIONS')[1];
      expect(rowBoth[1]).toBe('Block 20');
      expect(rowBoth[2]).toBe('Block 20');
    });

    it('10. Production + Output comparison covers A+B, production-only and output-only cases', () => {
      const ws = dailySheet({
        productions: [
          makeProduction({ productId: 'prd-a', lineId: 'lin-1', presses: 10, produced: 80 }),
          makeProduction({ id: 'p2', productId: 'prd-b', lineId: 'lin-2', presses: 20, produced: 160 })
        ],
        releases: [
          makeRelease({ productId: 'prd-b', lineId: 'lin-1', releasedQuantity: 500 }),
          makeRelease({ id: 'rel-2', productId: 'prd-a', lineId: 'lin-2', releasedQuantity: 300 })
        ]
      });
      const rows = section(ws, 'PRODUCTION + OUTPUT').slice(1);
      const find = (product: string) => rows.filter(r => r[2] === product);
      // A+B on lin-1: one production row + one output-only row for the other product
      expect(find('Block 20')).toContain(jasmine.arrayContaining(['Line 1 - Heavy', 'Block 20', 10, 80, 0]));
      expect(find('Block 15')).toContain(jasmine.arrayContaining(['Line 1 - Heavy', 'Block 15', 0, 0, 500]));
      // production-only on lin-2
      expect(find('Block 15')).toContain(jasmine.arrayContaining(['Line 2 - Standard', 'Block 15', 20, 160, 0]));
      // output-only on lin-2
      expect(find('Block 20')).toContain(jasmine.arrayContaining(['Line 2 - Standard', 'Block 20', 0, 0, 300]));
    });

    it('11. materials use Daily Actual = mixCount × perMixActual (kg retained, m³ via factor)', () => {
      const ws = dailySheet({ materials: [makeMaterial()] });
      const row = section(ws, 'MATERIALS BY RECORD (kg RETAINED FOR AUDIT)')[1];
      expect(row[2]).toBe(20); // Mix Count
      expect(row[3]).toBe(4200); // Cement kg = 210 × 20
      expect(row[4]).toBe(7600); // Sand kg retained
      expect(Math.abs((row[5] as number) - 4.75)).toBeLessThan(1e-6); // Sand m³
      expect(row[6]).toBe(10300); // Aggregate kg retained
      expect(Math.abs((row[7] as number) - (10300 / 1400))).toBeLessThan(1e-6); // Aggregate m³
      expect(row[8]).toBe(1900); // Water L
    });

    it('12. missing conversion factor → CONFIGURATION REQUIRED (never zero), kg retained', () => {
      const ws = dailySheet({ materials: [makeMaterial()], materialsMaster: MASTER_NO_SAND });
      const row = section(ws, 'MATERIALS BY RECORD (kg RETAINED FOR AUDIT)')[1];
      expect(row[4]).toBe(7600); // kg still shown for audit
      expect(row[5]).toBe(CONFIGURATION_REQUIRED);
    });

    it('13. daily quality sheet uses Recorded / Assessed / Passed / Failed and Passed÷Assessed rate', () => {
      const q = makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'FAIL' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      });
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'daily', qualityTests: [q] }));
      const qualityWs = wb.Sheets['Daily Quality Detail'] as XLSX.WorkSheet;
      expect(qualityWs).toBeDefined();
      expect(kpi(qualityWs, 'Samples Recorded')).toBe(3);
      expect(kpi(qualityWs, 'Samples Assessed')).toBe(2);
      expect(kpi(qualityWs, 'Samples Passed')).toBe(1);
      expect(kpi(qualityWs, 'Samples Failed')).toBe(1);
      expect(kpi(qualityWs, 'Sample Pass Rate')).toBe('50.0%');
    });

    it('14. daily Time Efficiency uses EfficiencyUtil aggregate (390 available − 30 downtime)', () => {
      const ws = dailySheet({ sessions: [makeSession()] });
      const expected = EfficiencyUtil.calculateEfficiency(0, 30).timeEfficiency.toFixed(1);
      expect(kpi(ws, 'Time Efficiency (%)')).toBe(`${expected}%`);
    });

    it('15. shift and overtime are preserved and shown', () => {
      const params = buildParams({
        sessions: [makeSession({ overtime: true, overtimeHours: 1, dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 1, downtimeMinutes: 0, downtimeReason: '', notes: '' }] })]
      });
      const ops = (svc as any).buildLineOperations(params);
      expect(ops[0].overtimeHours).toBe(1);
      expect(ops[0].shiftsLabel).toBe('Day');
      const ws = dailySheet({ sessions: params.sessions });
      expect(section(ws, 'LINE-LEVEL OPERATIONS')[1][3]).toBe('Day');
    });

    it('16. local calendar dates are used verbatim — no UTC shift across a month boundary', () => {
      const ws = dailySheet({
        productions: [
          makeProduction({ id: 'end-a', date: '2026-08-31', presses: 10, produced: 80 }),
          makeProduction({ id: 'end-b', date: '2026-09-01', presses: 20, produced: 160 })
        ]
      });
      const dates = section(ws, 'PRODUCTION + OUTPUT').slice(1).map(r => r[0]);
      expect(dates).toContain('2026-08-31');
      expect(dates).toContain('2026-09-01');
    });

    it('17. legacy single-measurement quality renders safely in daily quality detail', () => {
      const legacy = makeLegacyQuality();
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'daily', qualityTests: [legacy] }));
      const qualityWs = wb.Sheets['Daily Quality Detail'] as XLSX.WorkSheet;
      const rows = rowsOf(qualityWs);
      const dateCell = rows.some(r => r[0] === TODAY);
      expect(dateCell).toBeTrue();
      // legacy sample column renders "—", result FAIL preserved
      const detailRows = section(qualityWs, 'QUALITY TEST RESULTS').slice(1);
      expect(detailRows.length).toBe(1);
      expect(detailRows[0][4]).toBe('—');
      expect(detailRows[0][15]).toBe('FAIL');
    });
  });

  // ═══════════ MONTHLY REGRESSIONS (18–28) ═══════════

  describe('MONTHLY REPORT', () => {

    const twoDay: Partial<ReportParams> = {
      productions: [
        makeProduction({ presses: 10, produced: 80, date: '2026-08-01' }),
        makeProduction({ id: 'p2', presses: 20, produced: 160, date: '2026-08-02' })
      ],
      releases: [
        makeRelease({ productId: 'prd-a', releasedQuantity: 500, releaseDate: '2026-08-01' }),
        makeRelease({ id: 'rel-2', productId: 'prd-a', releasedQuantity: 400, releaseDate: '2026-08-02' })
      ],
      range: { preset: 'custom', startDate: '2026-08-01', endDate: '2026-08-31', label: 'Month' }
    };

    it('18. monthly workbook contains a "Monthly Operational" sheet', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'monthly' }));
      expect(wb.Sheets['Monthly Operational']).toBeDefined();
    });

    it('19. monthly KPIs aggregate presses, produced, released and mixes', () => {
      const ws = monthlySheet(twoDay);
      expect(kpi(ws, 'Total Presses')).toBe(30);
      expect(kpi(ws, 'Total Produced')).toBe(240);
      expect(kpi(ws, 'Released Output')).toBe(900);
    });

    it('20. monthly product breakdown aggregates by product', () => {
      const ws = monthlySheet(twoDay);
      const rows = section(ws, 'MONTHLY PRODUCTION + OUTPUT BY PRODUCT').slice(1);
      expect(rows).toEqual([
        ['Block 20', 30, 240, 900]
      ]);
    });

    it('21. monthly line summary aggregates multiple days for the same line', () => {
      const ws = monthlySheet({
        ...twoDay,
        materials: [makeMaterial({ date: '2026-08-01' }), makeMaterial({ id: 'mat-2', date: '2026-08-02' })]
      });
      const row = section(ws, 'MONTHLY LINE SUMMARY')[1];
      expect(row[1]).toContain('Block 20'); // Pressed Product(s)
      expect(row[2]).toContain('Block 20'); // Released Product(s)
      expect(row[4]).toBe(30); // presses
      expect(row[5]).toBe(240); // produced
      expect(row[6]).toBe(900); // released
      expect(row[7]).toBe(40); // mix count
      expect(row[8]).toBe(8400); // cement kg
    });

    it('22. monthly Time Efficiency is the weighted ratio of total run / total available minutes', () => {
      const sessions = [
        makeSession({ id: 's1', date: '2026-08-01', dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 0, downtimeMinutes: 0, downtimeReason: '', notes: '' }] }),
        makeSession({ id: 's2', date: '2026-08-02', dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 1.5, downtimeMinutes: 30, downtimeReason: '', notes: '' }] })
      ];
      const ws = monthlySheet({ sessions });
      // (390 + 450) / (390 + 480) = 840 / 870 = 96.5517…%
      expect(kpi(ws, 'Time Efficiency (%)')).toBe('96.6%');
    });

    it('23. monthly efficiency is NOT the average of daily percentages', () => {
      const sessions = [
        makeSession({ id: 's1', date: '2026-08-01', dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 0, downtimeMinutes: 0, downtimeReason: '', notes: '' }] }),
        makeSession({ id: 's2', date: '2026-08-02', dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 1.5, downtimeMinutes: 30, downtimeReason: '', notes: '' }] })
      ];
      const dailyEffs = sessions.map(s => EfficiencyUtil.calculateEfficiency(s.dailyLineTime[0].overtimeHours, s.dailyLineTime[0].downtimeMinutes).timeEfficiency);
      const naiveAverage = dailyEffs.reduce((a, b) => a + b, 0) / dailyEffs.length;
      expect(naiveAverage).toBe(96.875);
      const ws = monthlySheet({ sessions });
      expect(kpi(ws, 'Time Efficiency (%)')).not.toBe(`${naiveAverage.toFixed(1)}%`);
    });

    it('24. monthly materials aggregate kg and m³ per line', () => {
      const ws = monthlySheet({
        materials: [makeMaterial({ date: '2026-08-01' }), makeMaterial({ id: 'mat-2', date: '2026-08-02' })],
        range: twoDay.range
      });
      const rows = section(ws, 'MONTHLY MATERIALS BY LINE').slice(1);
      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('2026-08');
      expect(rows[0][2]).toBe(40); // mix count
      expect(rows[0][3]).toBe(8400); // cement kg
      expect(rows[0][4]).toBe(15200); // sand kg
      expect(Math.abs((rows[0][5] as number) - (15200 / 1600))).toBeLessThan(1e-6); // sand m³
      expect(Math.abs((rows[0][7] as number) - (20600 / 1400))).toBeLessThan(1e-6); // aggregate m³
      expect(rows[0][8]).toBe(3800); // water L
    });

    it('25. monthly quality summary shows Recorded / Assessed / Passed / Failed / Rate', () => {
      const q = makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      });
      const ws = monthlySheet({ qualityTests: [q] });
      const rows = section(ws, 'MONTHLY QUALITY SUMMARY').slice(1);
      expect(rows[0]).toEqual([3, 2, 2, 0, 1, '100.0%']);
    });

    it('26. legacy ambiguous releases remain labeled "Unattributed Release" in monthly report', () => {
      const ws = monthlySheet({
        releases: [makeRelease({ id: 'rel-2', productId: undefined, dataSource: 'LEGACY_AMBIGUOUS_SESSION', releasedQuantity: 300 })]
      });
      const rows = section(ws, 'MONTHLY PRODUCTION + OUTPUT BY PRODUCT').slice(1);
      expect(rows).toEqual([['Unattributed Release', 0, 0, 300]]);
    });

    it('27. shift and overtime are retained in the monthly line summary', () => {
      const params = buildParams({
        type: 'monthly',
        sessions: [makeSession({ overtime: true, overtimeHours: 2, dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 2, downtimeMinutes: 0, downtimeReason: '', notes: '' }] })]
      });
      const ops = (svc as any).buildLineOperations(params);
      expect(ops[0].overtimeHours).toBe(2);
      expect(ops[0].shiftsLabel).toBe('Day');
      const ws = monthlySheet(params.sessions ? { sessions: params.sessions } : {});
      expect(section(ws, 'MONTHLY LINE SUMMARY')[1][3]).toBe('Day');
    });

    it('28. report rendering never shifts local dates across months (Aug 31 stays Aug 31)', () => {
      expect((svc as any).fmtDate('2026-08-31')).toBe('Aug 31, 2026');
      expect((svc as any).fmtDate('2026-09-01')).toBe('Sep 1, 2026');
      const ws = monthlySheet({ range: twoDay.range });
      const headerLine = rowsOf(ws)[4][0];
      expect(headerLine).toContain('Aug 31, 2026');
      expect(headerLine).not.toContain('Sep 1, 2026');
      const pO = (svc as any).buildProductionOutput(buildParams({
        productions: [
          makeProduction({ id: 'a', date: '2026-08-31', presses: 10, produced: 80 }),
          makeProduction({ id: 'b', date: '2026-09-01', presses: 20, produced: 160 })
        ]
      }));
      const dates = pO.map((r: any) => r.date);
      expect(dates).toContain('2026-08-31');
      expect(dates).toContain('2026-09-01');
    });
  });

  // ═══════════ INTEGRITY REGRESSIONS (29–34) ═══════════

  describe('INTEGRITY', () => {

    function frozenParams(): ReportParams {
      const params = buildParams({
        productions: deepFreeze([
          makeProduction({ presses: 10, produced: 80 }),
          makeProduction({ id: 'p2', date: '2026-08-30', presses: 20, produced: 160 })
        ]),
        releases: deepFreeze([
          makeRelease({ releasedQuantity: 500 }),
          makeRelease({ id: 'rel-2', productId: undefined, dataSource: 'LEGACY_AMBIGUOUS_SESSION', releasedQuantity: 300 })
        ]),
        materials: deepFreeze([makeMaterial(), makeMaterial({ id: 'mat-2', lineId: 'lin-2', mixCount: 10 }) ]),
        qualityTests: deepFreeze([
          makeQuality(),
          makeLegacyQuality()
        ])
      });
      return params;
    }

    function runBothBuilders(params: ReportParams): void {
      expect(() => (svc as any).buildExcelWorkbook(buildParams({ ...params, type: 'daily' }))).not.toThrow();
      expect(() => (svc as any).buildExcelWorkbook(buildParams({ ...params, type: 'monthly' }))).not.toThrow();
      expect(() => (svc as any).buildPdfDoc(buildParams({ ...params, type: 'daily' }))).not.toThrow();
    }

    it('29. report generation does not modify Production records', () => {
      const params = frozenParams();
      const before = JSON.stringify(params.productions);
      runBothBuilders(params);
      expect(JSON.stringify(params.productions)).toBe(before);
      expect(Object.isFrozen(params.productions)).toBeTrue();
    });

    it('30. report generation does not modify Output Release records', () => {
      const params = frozenParams();
      const before = JSON.stringify(params.releases);
      runBothBuilders(params);
      expect(JSON.stringify(params.releases)).toBe(before);
      expect(Object.isFrozen(params.releases)).toBeTrue();
    });

    it('31. report generation does not modify Material records', () => {
      const params = frozenParams();
      const before = JSON.stringify(params.materials);
      runBothBuilders(params);
      expect(JSON.stringify(params.materials)).toBe(before);
      expect(Object.isFrozen(params.materials)).toBeTrue();
    });

    it('32. report generation does not modify Quality test records', () => {
      const params = frozenParams();
      const before = JSON.stringify(params.qualityTests);
      runBothBuilders(params);
      expect(JSON.stringify(params.qualityTests)).toBe(before);
      expect(Object.isFrozen(params.qualityTests)).toBeTrue();
    });

    it('33. legacy ambiguous releases are preserved and labeled, never invented onto a product', () => {
      const params = buildParams({
        releases: [makeRelease({ id: 'rel-x', productId: undefined, dataSource: 'LEGACY_AMBIGUOUS_SESSION', releasedQuantity: 300, lineId: 'lin-1', legacySessionId: 'sess-9' })]
      });
      const wb = (svc as any).buildExcelWorkbook(buildParams({ ...params, type: 'monthly' }));
      const ws = wb.Sheets['Monthly Operational'] as XLSX.WorkSheet;
      const rows = section(ws, 'MONTHLY PRODUCTION + OUTPUT BY PRODUCT').slice(1);
      expect(rows).toEqual([['Unattributed Release', 0, 0, 300]]);
      expect(params.releases[0].productId).toBeUndefined();
    });

    it('34. legacy single-measurement quality renders safely and counts as one QUANTITY sample', () => {
      const legacy = makeLegacyQuality();
      const stats = (svc as any).qualityStats([legacy]);
      expect(stats).toEqual({ recorded: 1, assessed: 1, passed: 0, failed: 1, passRate: '0.0' });
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'daily', qualityTests: [legacy] }));
      const qualityWs = wb.Sheets['Daily Quality Detail'] as XLSX.WorkSheet;
      const detailRows = section(qualityWs, 'QUALITY TEST RESULTS').slice(1);
      expect(detailRows.length).toBe(1);
      expect(detailRows[0][4]).toBe('—');
      expect(detailRows[0][15]).toBe('FAIL');
    });
  });

  // ═══════════ EXISTING REPORT-TYPE COMPATIBILITY ═══════════

  describe('EXISTING REPORT TYPES', () => {

    it('production sheet still builds and uses OutputRelease-independent KPI fields', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({
        type: 'production',
        productions: [makeProduction()],
        releases: [makeRelease({ releasedQuantity: 500 })]
      }));
      expect(wb.Sheets['Production']).toBeDefined();
    });

    it('materials sheet still builds', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'materials', materials: [makeMaterial()] }));
      expect(wb.Sheets['Materials']).toBeDefined();
    });

    it('quality sheet still builds with corrected Recorded/Assessed denominators', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'quality', qualityTests: [makeQuality()] }));
      expect(wb.Sheets['Quality']).toBeDefined();
      const qWs = wb.Sheets['Quality'] as XLSX.WorkSheet;
      expect(kpi(qWs, 'Samples Recorded')).toBe(3);
      expect(kpi(qWs, 'Samples Assessed')).toBe(3);
      expect(kpi(qWs, 'Sample Pass Rate')).toBe('100.0%');
    });

    it('complete report builds executive summary and quality summary with new denominators', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'complete', qualityTests: [makeQuality()] }));
      expect(wb.Sheets['Executive Summary']).toBeDefined();
      const es = wb.Sheets['Executive Summary'] as XLSX.WorkSheet;
      expect(kpi(es, 'Samples Recorded')).toBe(3);
    });

    it('daily and monthly PDF documents build without error', () => {
      const params = buildParams({
        productions: [makeProduction()],
        releases: [makeRelease()],
        materials: [makeMaterial()],
        qualityTests: [makeQuality()],
        sessions: [makeSession()]
      });
      const dailyDoc = (svc as any).buildPdfDoc({ ...params, type: 'daily' });
      expect(dailyDoc.getNumberOfPages()).toBeGreaterThan(0);
      const monthlyDoc = (svc as any).buildPdfDoc({ ...params, type: 'monthly' });
      expect(monthlyDoc.getNumberOfPages()).toBeGreaterThan(0);
    });

    it('qualityStats counts three-sample CONFIGURATION_REQUIRED as recorded but never as failed', () => {
      const stats = (svc as any).qualityStats([makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      })]);
      expect(stats.recorded).toBe(3);
      expect(stats.assessed).toBe(2);
      expect(stats.failed).toBe(0);
    });
  });

  // ═══════════ QUALITY RECORDED VS ASSESSED (35–40) ═══════════

  describe('QUALITY RECORDED VS ASSESSED', () => {

    it('35. three assessed samples → Recorded=3, Assessed=3', () => {
      const stats = (svc as any).qualityStats([makeQuality()]);
      expect(stats.recorded).toBe(3);
      expect(stats.assessed).toBe(3);
    });

    it('36. 2 assessed + 1 CONFIGURATION_REQUIRED → Recorded=3, Assessed=2', () => {
      const q = makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'FAIL' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      });
      const stats = (svc as any).qualityStats([q]);
      expect(stats.recorded).toBe(3);
      expect(stats.assessed).toBe(2);
      expect(stats.recorded - stats.assessed).toBe(1);
    });

    it('37. CONFIGURATION_REQUIRED does not count as Failed (or Passed)', () => {
      const q = makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      });
      const stats = (svc as any).qualityStats([q]);
      expect(stats.failed).toBe(0);
      expect(stats.passed).toBe(2);
      expect(stats.recorded - stats.assessed).toBe(1);
    });

    it('38. Pass Rate always uses Assessed as the denominator', () => {
      const allAssessed = (svc as any).qualityStats([makeQuality()]);
      expect(allAssessed.passRate).toBe('100.0');
      const onePending = (svc as any).qualityStats([makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      })]);
      // PASSED / ASSESSED = 2/2 → 100.0%, NOT PASSED / RECORDED = 2/3
      expect(onePending.passRate).toBe('100.0');
      const mixed = (svc as any).qualityStats([makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'FAIL' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      })]);
      expect(mixed.passRate).toBe('50.0');
    });

    it('39. Daily Operational sheet exposes Recorded and Assessed separately', () => {
      const ws = dailySheet({
        qualityTests: [makeQuality({
          samples: [
            makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
            makeSample({ sampleNumber: 2, compressionResult: 'FAIL' }),
            makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
          ]
        })]
      });
      expect(kpi(ws, 'Samples Recorded')).toBe(3);
      expect(kpi(ws, 'Samples Assessed')).toBe(2);
      expect(kpi(ws, 'Samples Passed')).toBe(1);
      expect(kpi(ws, 'Samples Failed')).toBe(1);
      expect(kpi(ws, 'Samples Pending Configuration')).toBe(1);
    });

    it('40. Monthly Operational sheet exposes Recorded and Assessed separately', () => {
      const ws = monthlySheet({
        qualityTests: [makeQuality({
          samples: [
            makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
            makeSample({ sampleNumber: 2, compressionResult: 'PASS' }),
            makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
          ]
        })]
      });
      expect(kpi(ws, 'Samples Recorded')).toBe(3);
      expect(kpi(ws, 'Samples Assessed')).toBe(2);
      expect(kpi(ws, 'Samples Pending Configuration')).toBe(1);
      expect(kpi(ws, 'Sample Pass Rate (%)')).toBe('100.0%');
    });
  });

  // ═══════════ QUALITY PDF LANDSCAPE LAYOUT ═══════════

  describe('QUALITY PDF LANDSCAPE LAYOUT', () => {

    const EXP_HEADS = ['Date', 'Product', 'Line', 'Test Date', 'Sample',
      'Actual Height', 'Standard Height', 'Height Difference',
      'Actual Weight (kg)', 'Standard Weight (kg)', 'Weight Difference (kg)',
      'Load (kN)', 'Area (cm²)', 'Compression', 'Compression Standard', 'Result'];

    it('quality PDF opens in LANDSCAPE (297 × 210 mm)', () => {
      const doc = (svc as any).buildPdfDoc(buildParams({ type: 'quality', format: 'pdf', qualityTests: [makeQuality()] }));
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(210, 1);
      expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    });

    it('production PDF stays PORTRAIT (only Quality is flipped to landscape)', () => {
      const doc = (svc as any).buildPdfDoc(buildParams({ type: 'production', format: 'pdf' }));
      expect(doc.internal.pageSize.getWidth()).toBeLessThan(doc.internal.pageSize.getHeight());
    });

    it('renders the confirmed 16 Quality columns in order with full readable headers', () => {
      const head = (svc as any).buildQualityHead() as string[][];
      expect(head.length).toBe(1);
      expect(head[0]).toEqual(EXP_HEADS);
      expect(head[0].length).toBe(16);
    });

    it('landscape column widths fit the 269mm usable width and keep numeric columns wide enough', () => {
      const styles = (svc as any).buildQualityColumnStyles() as Record<number, { cellWidth: number; halign?: string }>;
      const total = Object.keys(styles).reduce((s, k) => s + styles[Number(k)].cellWidth, 0);
      expect(total).toBeLessThanOrEqual(269);
      Object.keys(styles).forEach(k => expect(styles[Number(k)].cellWidth).toBeGreaterThanOrEqual(11));
      expect(styles[0]).toEqual(jasmine.objectContaining({ cellWidth: 22 }));
      expect(styles[1]).toEqual(jasmine.objectContaining({ cellWidth: 24 }));
      expect(styles[11]).toEqual(jasmine.objectContaining({ cellWidth: 12 }));
      expect(styles[5]).toEqual(jasmine.objectContaining({ halign: 'right' }));
      expect(styles[14]).toEqual(jasmine.objectContaining({ halign: 'right' }));
      expect(styles[15]).toEqual(jasmine.objectContaining({ cellWidth: 14 }));
    });

    it('large quality reports span multiple landscape pages with PASS/FAIL kept as visible text', () => {
      const many = Array.from({ length: 30 }, (_, i) => makeQuality({ id: 'qt-q' + i }));
      const doc = (svc as any).buildPdfDoc(buildParams({ type: 'quality', format: 'pdf', qualityTests: many }));
      expect(doc.getNumberOfPages()).toBeGreaterThan(1);

      const body = (svc as any).buildQualityBody(buildParams({
        type: 'quality',
        qualityTests: [
          makeQuality(),
          makeLegacyQuality()
        ]
      })) as string[][];
      // makeQuality() → 3 sample rows + 1 inline AVERAGE row; legacy → 1 row
      expect(body.length).toBe(5);
      body.forEach(r => expect(r.length).toBe(16));
      expect(body.some(r => r[15] === 'PASS')).toBeTrue();
      expect(body.some(r => r[15] === 'FAIL')).toBeTrue();
    });

    it('quality summary metric lists are unchanged (Recorded / Assessed / Passed / Failed / Pass Rate)', () => {
      const stats = (svc as any).qualityStats([makeQuality({
        samples: [
          makeSample({ sampleNumber: 1, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 2, compressionResult: 'PASS' }),
          makeSample({ sampleNumber: 3, compressionResult: 'CONFIGURATION_REQUIRED' })
        ]
      })]);
      expect(stats).toEqual({ recorded: 3, assessed: 2, passed: 2, failed: 0, passRate: '100.0' });
    });
  });

  // ═══════════ CORRECTIONS PASS (TIME / PROD / MATERIALS / QUALITY / COMPLETE) ═══════════

  describe('CORRECTIONS PASS', () => {

    const DEMO_MASTER: UnitCost[] = [
      { id: 'cst-cem', materialId: 'mat-cement', unitCost: 0.05, unit: 'per kg', demo: true, createdAt: NOW }
    ];

    // ─── TIME (authoritative 390/day/line) ──────────────────────────────────

    it('TIME-1. available time is 390 minutes per line per day (EfficiencyUtil authority)', () => {
      const t = (svc as any).timeAggregate(buildParams({ sessions: [makeSession()] }));
      expect(t.totalAvailableMinutes).toBe(390);
      expect(t.totalDowntimeMinutes).toBe(30);
      expect(t.totalActualRunMinutes).toBe(360);
      expect(t.timeEfficiency).toBe((360 / 390 * 100).toFixed(1));
    });

    it('TIME-2. two sessions for the SAME line on the SAME day still yield 390 minutes (never multiplied)', () => {
      const t = (svc as any).timeAggregate(buildParams({
        sessions: [makeSession(), makeSession({ id: 'sess-2' })]
      }));
      expect(t.totalAvailableMinutes).toBe(390);
    });

    it('TIME-3. two LINES on one day yield 780 minutes (390 each)', () => {
      const t = (svc as any).timeAggregate(buildParams({
        sessions: [
          makeSession(),
          makeSession({ id: 'sess-2', lineId: 'lin-2', dailyLineTime: [{ lineId: 'lin-2', lineName: 'Line 2 - Standard', overtimeHours: 0, downtimeMinutes: 0, downtimeReason: '', notes: '' }] })
        ]
      }));
      expect(t.totalAvailableMinutes).toBe(780);
    });

    it('TIME-4. overtime adds 60 minutes to a line\'s 390-minute base', () => {
      const t = (svc as any).timeAggregate(buildParams({
        sessions: [makeSession({ dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 1, downtimeMinutes: 0, downtimeReason: '', notes: '' }] })]
      }));
      expect(t.totalAvailableMinutes).toBe(450);
      expect(t.totalOvertimeHours).toBe(1);
    });

    it('TIME-5. Case B: 1.5h OT + 30min DT → Available 480, Run 450, Efficiency 93.75%', () => {
      const eff = EfficiencyUtil.calculateEfficiency(1.5, 30);
      expect(eff.availableMinutes).toBe(480);
      expect(eff.actualRunMinutes).toBe(450);
      expect(eff.timeEfficiency).toBeCloseTo((450 / 480) * 100, 4);
      const sessions = [makeSession({ dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 1.5, downtimeMinutes: 30, downtimeReason: '', notes: '' }] })];
      const ws = (svc as any).buildExcelWorkbook(buildParams({ sessions })).Sheets['Daily Operational'] as XLSX.WorkSheet;
      expect(kpi(ws, 'Time Efficiency (%)')).toBe('93.8%');
      const ops = (svc as any).buildLineOperations(buildParams({ sessions }));
      expect(ops[0].availableMinutes).toBe(480);
      expect(ops[0].actualRunMinutes).toBe(450);
      expect(ops[0].timeEfficiency).toBeCloseTo(93.75, 4);
    });

    it('TIME-6. multi-product Line/day counts the 390-min base once (never × products or sessions)', () => {
      const ops = (svc as any).buildLineOperations(buildParams({
        sessions: [
          makeSession(),
          makeSession({ id: 'sess-2', dailyLineTime: [{ lineId: 'lin-1', lineName: 'Line 1 - Heavy', overtimeHours: 0, downtimeMinutes: 0, downtimeReason: '', notes: '' }] })
        ],
        productions: [makeProduction(), makeProduction({ id: 'p2', productId: 'prd-b', presses: 20, produced: 160 })]
      }));
      expect(ops[0].availableMinutes).toBe(390);    // base counted once despite 2 sessions
      expect(ops[0].actualRunMinutes).toBe(360);    // 390 − (30 + 0) downtime
      expect(ops[0].timeEfficiency).toBeCloseTo((360 / 390) * 100, 4);
    });

    // ─── PRODUCTION (press-only 12-col + independent Released Output) ────────

    it('PROD-5. production sheet uses 12 press-only columns including Notes — no Released Output', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'production', productions: [makeProduction()], sessions: [makeSession()] }));
      const ws = wb.Sheets['Production'] as XLSX.WorkSheet;
      const rs = rowsOf(ws);
      const header = rs.find(r => r[0] === 'Date' && r[1] === 'Line');
      expect(header).toEqual(['Date', 'Line', 'Product', 'Shift', 'Supervisor', 'Pieces/Press', 'Presses', 'Produced', 'Overtime (hrs)', 'Downtime (min)', 'Downtime Reason', 'Notes']);
      expect(rs.some(r => r.includes('Released Output'))).toBeFalse();
    });

    it('PROD-6. complete workbook contains Executive Summary, Production, Materials and Quality sheets', () => {
      const wb = (svc as any).buildExcelWorkbook(buildParams({ type: 'complete' }));
      expect(wb.Sheets['Executive Summary']).toBeDefined();
      expect(wb.Sheets['Production']).toBeDefined();
      expect(wb.Sheets['Materials']).toBeDefined();
      expect(wb.Sheets['Quality']).toBeDefined();
    });

    it('PROD-7. computeStats totalReleased sums Output Releases only (ignores production.releasedOutput)', () => {
      const stats = (svc as any).computeStats(buildParams({
        productions: [makeProduction({ releasedOutput: 50 })],
        releases: [makeRelease({ releasedQuantity: 500 }), makeRelease({ id: 'rel-2', productId: undefined, dataSource: 'LEGACY_AMBIGUOUS_SESSION', releasedQuantity: 300 })]
      }));
      expect(stats.totalReleased).toBe(800);
    });

    it('PROD-8. production sheet KPIs expose Overtime / Downtime from the authoritative time aggregate', () => {
      const ws = (svc as any).buildExcelWorkbook(buildParams({
        type: 'production',
        productions: [makeProduction()],
        sessions: [makeSession()]
      })).Sheets['Production'] as XLSX.WorkSheet;
      expect(kpi(ws, 'Total Production')).toBe(80);
      expect(kpi(ws, 'Total Presses')).toBe(10);
      expect(kpi(ws, 'Total Overtime (hrs)')).toBe(0);
      expect(kpi(ws, 'Total Downtime (min)')).toBe(30);
    });

    // ─── MATERIALS (by-line summary + demo exclusion) ────────────────────────

    it('MAT-9. materials sheet leads with a MATERIALS BY LINE summary', () => {
      const ws = (svc as any).buildExcelWorkbook(buildParams({ type: 'materials', materials: [makeMaterial()] })).Sheets['Materials'] as XLSX.WorkSheet;
      const rows = section(ws, 'MATERIALS BY LINE').slice(1);
      expect(rows[0][0]).toBe('Line 1 - Heavy');
      expect(rows[0][1]).toBe(20);      // mix count
      expect(rows[0][2]).toBe(4200);    // cement kg
      expect(rows[0][3]).toBe(7600);    // sand kg
      expect(Math.abs((rows[0][4] as number) - 4.75)).toBeLessThan(1e-6); // sand m³
      expect(rows[0][5]).toBe(10300);   // aggregate kg
      expect(Math.abs((rows[0][6] as number) - (10300 / 1400))).toBeLessThan(1e-6); // aggregate m³
      expect(rows[0][7]).toBe(1900);    // water L
    });

    it('MAT-10. materials details rows carry the Line column', () => {
      const body = (svc as any).buildMaterialsBody(buildParams({ materials: [makeMaterial()] })) as string[][];
      expect(body[0][0]).toBe('2026-08-29');
      expect(body[0][1]).toBe('Line 1 - Heavy');
      expect(body[0][2]).toBe('Block 20');
      expect(body[0][3]).toBe('20');
    });

    it('MAT-11. DEMO unit-costs render "—" and are excluded from the grand total (master config untouched)', () => {
      const ws = (svc as any).buildExcelWorkbook(buildParams({
        type: 'materials',
        materials: [makeMaterial()],
        unitCostsMaster: DEMO_MASTER
      })).Sheets['Materials'] as XLSX.WorkSheet;
      expect(kpi(ws, 'Grand Total Cost')).toBe(869 - 210); // cement demo → 659
      const details = section(ws, 'MATERIALS DETAILS').slice(1);
      const cement = details.find(r => r[4] === 'Cement');
      expect(cement![9]).toBe('—');
      expect(cement![10]).toBe('—');
    });

    it('MAT-12. buildMaterialsBody shows "—" for demo unit costs and totals', () => {
      const body = (svc as any).buildMaterialsBody(buildParams({ materials: [makeMaterial()], unitCostsMaster: DEMO_MASTER })) as string[][];
      const cement = body.find(r => r[4] === 'Cement');
      expect(cement![9]).toBe('—');
      expect(cement![10]).toBe('—');
      const sand = body.find(r => r[4] === 'Sand');
      expect(sand![9]).not.toBe('—');
    });

    it('MAT-13. line-level MATERIALS BY LINE sums are unaffected by demo flags (kg retained)', () => {
      const line = (svc as any).buildLineMaterialRows(buildParams({ materials: [makeMaterial()], unitCostsMaster: DEMO_MASTER }));
      expect(line[0].cementKg).toBe(4200);
      expect(line[0].mixCount).toBe(20);
    });

    it('MAT-14. materials PDF + complete Excel expose the Total Released Output KPI', () => {
      const doc = (svc as any).buildPdfDoc(buildParams({ type: 'materials', format: 'pdf', materials: [makeMaterial()] }));
      expect(doc.getNumberOfPages()).toBeGreaterThan(0);
      const es = (svc as any).buildExcelWorkbook(buildParams({
        type: 'complete',
        releases: [makeRelease({ releasedQuantity: 800 })]
      })).Sheets['Executive Summary'] as XLSX.WorkSheet;
      expect(kpi(es, 'Total Released Output')).toBe(800);
    });

    it('MAT-15. missing per-mix standard (recipe not configured) → Theoretical "Not Configured", Variance "—"', () => {
      const body = (svc as any).buildMaterialsBody(buildParams({ materials: [makeMaterial()] })) as string[][];
      const cement = body.find(r => r[4] === 'Cement');
      expect(cement![6]).toBe('Not Configured');
      expect(cement![7]).toBe('4,200'); // actual kg retained
      expect(cement![8]).toBe('—');
      const ws = (svc as any).buildExcelWorkbook(buildParams({ type: 'materials', materials: [makeMaterial()] })).Sheets['Materials'] as XLSX.WorkSheet;
      const details = section(ws, 'MATERIALS DETAILS').slice(1);
      const dCement = details.find(r => r[4] === 'Cement');
      expect(dCement![6]).toBe('Not Configured');
      expect(dCement![7]).toBe(4200);
      expect(dCement![8]).toBe('—');
      // a configured standard renders real values instead
      const configured = makeMaterial({
        materials: [{
          materialId: 'mat-cement', materialName: 'Cement', unit: 'kg',
          perMixStandard: 200, perMixActual: 210, theoreticalQuantity: 4000,
          actualQuantity: 4200, variance: 200, dimensionOk: true, unitCost: 0.05, totalCost: 210
        }]
      });
      const configuredBody = (svc as any).buildMaterialsBody(buildParams({ materials: [configured] })) as string[][];
      expect(configuredBody[0][6]).toBe('4,000');
      expect(configuredBody[0][8]).toBe('200');
    });

    // ─── QUALITY (inline AVERAGE rows + cm² + Pending Configuration) ─────────

    it('QUAL-15. buildQualityBody appends an inline AVERAGE row after a three-sample event', () => {
      const body = (svc as any).buildQualityBody(buildParams({ qualityTests: [makeQuality()] })) as string[][];
      expect(body.length).toBe(4); // 3 sample rows + 1 AVERAGE
      const avg = body[3];
      expect(avg[0]).toBe('AVERAGE');
      expect(avg[4]).toBe('3 samples');
      expect(avg[5]).toBe('200');      // avg height
      expect(avg[11]).toBe('3.2');     // avg load
      expect(avg[15]).toBe('—');       // never PASS/FAIL
    });

    it('QUAL-16. AVERAGE rows never carry PASS/FAIL verdicts', () => {
      const body = (svc as any).buildQualityBody(buildParams({ qualityTests: [makeQuality()] })) as string[][];
      const avg = body.find(r => r[0] === 'AVERAGE');
      expect(avg).toBeDefined();
      expect(avg![15]).toBe('—');
      expect(['PASS', 'FAIL']).not.toContain(avg![15]);
    });

    it('QUAL-17. AVERAGE row is omitted when height, weight or load is missing/invalid', () => {
      const body = (svc as any).buildQualityBody(buildParams({
        qualityTests: [makeQuality({ samples: [makeSample({ sampleNumber: 1, load: 3.2 }), makeSample({ sampleNumber: 2, load: 3.2 }), makeSample({ sampleNumber: 3, load: undefined as unknown as number })] })]
      })) as string[][];
      expect(body.some(r => r[0] === 'AVERAGE')).toBeFalse();
    });

    it('QUAL-18. inline AVERAGE compression uses QualityCalculationUtil.averageCompression', () => {
      const expected = QualityCalculationUtil.averageCompression([20, 24, 28]);
      const body = (svc as any).buildQualityBody(buildParams({
        qualityTests: [makeQuality({
          samples: [
            makeSample({ sampleNumber: 1, compression: 20 }),
            makeSample({ sampleNumber: 2, compression: 24 }),
            makeSample({ sampleNumber: 3, compression: 28 })
          ]
        })]
      })) as string[][];
      const avg = body.find(r => r[0] === 'AVERAGE');
      expect(Number(avg![13])).toBeCloseTo(expected as number, 4);
    });

    it('QUAL-19. quality sheet contains inline AVERAGE rows and no separate three-sample averages section', () => {
      const ws = (svc as any).buildExcelWorkbook(buildParams({ type: 'quality', qualityTests: [makeQuality()] })).Sheets['Quality'] as XLSX.WorkSheet;
      const rs = rowsOf(ws);
      expect(rs.some(r => r[0] === 'AVERAGE')).toBeTrue();
      expect(rs.some(r => (r[0] as string) === 'QUALITY EVENT AVERAGES (THREE-SAMPLE)')).toBeFalse();
    });

    it('QUAL-20. quality sheet QUALITY SUMMARY exposes Samples Pending Configuration', () => {
      const ws = (svc as any).buildExcelWorkbook(buildParams({ type: 'quality', qualityTests: [makeQuality()] })).Sheets['Quality'] as XLSX.WorkSheet;
      const summaryHeader = rowsOf(ws).find(r => r.includes('Samples Pending Configuration'));
      expect(summaryHeader).toEqual(['Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Samples Pending Configuration', 'Sample Pass Rate']);
    });

    it('QUAL-21. quality head uses Area (cm²)', () => {
      const head = (svc as any).buildQualityHead() as string[][];
      expect(head[0][12]).toBe('Area (cm²)');
    });

    it('QUAL-22. legacy single-measurement quality produces no AVERAGE row (samples < 3)', () => {
      const body = (svc as any).buildQualityBody(buildParams({ qualityTests: [makeLegacyQuality()] })) as string[][];
      expect(body.length).toBe(1);
      expect(body.some(r => r[0] === 'AVERAGE')).toBeFalse();
    });

    // ─── COMPLETE (production/quality sections) ──────────────────────────────

    it('COMPLETE-23. complete PDF builds with production, materials and quality sections', () => {
      const doc = (svc as any).buildPdfDoc(buildParams({
        type: 'complete', format: 'pdf',
        productions: [makeProduction()],
        sessions: [makeSession()],
        materials: [makeMaterial()],
        qualityTests: [makeQuality()],
        releases: [makeRelease()]
      }));
      expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    });

    it('COMPLETE-24. complete production section is press-only with Notes and no inline Released column', () => {
      const body = (svc as any).buildProductionBody(buildParams({ productions: [makeProduction()], sessions: [makeSession()] })) as string[][];
      expect(body[0].length).toBe(12);
      expect(body[0][11]).toBe('');
      const completePdf = (svc as any).buildPdfDoc(buildParams({ type: 'complete', format: 'pdf', productions: [makeProduction()] }));
      expect(completePdf.getNumberOfPages()).toBeGreaterThan(0);
    });

    it('COMPLETE-25. complete quality section is a concise Management Quality Summary (portrait, no 16-col repeat)', () => {
      const params = buildParams({ qualityTests: [makeQuality()] });
      const mgmt = (svc as any).buildQualityManagementRows(params);
      expect(mgmt.length).toBe(1);
      const r = mgmt[0];
      expect(r.lineName).toBe('Line 1 - Heavy');
      expect(r.productName).toBe('Block 20');
      expect(r.recorded).toBe(3);
      expect(r.assessed).toBe(3);
      expect(r.passed).toBe(3);
      expect(r.failed).toBe(0);
      expect(r.passRate).toBe('100.0');
      expect(r.avgHeight).toBe(200);
      expect(r.avgWeight).toBe(100);
      expect(r.avgLoad).toBe(3.2);
      expect(r.avgCompression).toBe(16);
      const doc = (svc as any).buildPdfDoc(buildParams({ type: 'complete', format: 'pdf', qualityTests: [makeQuality()] }));
      expect(doc.getNumberOfPages()).toBeGreaterThan(0);
      expect(doc.internal.pageSize.getWidth()).toBeLessThan(doc.internal.pageSize.getHeight());
      const qualityWs = (svc as any).buildExcelWorkbook(buildParams({ type: 'complete', qualityTests: [makeQuality()] })).Sheets['Quality'] as XLSX.WorkSheet;
      const head = rowsOf(qualityWs).find(r => r.includes('Avg Actual Height'));
      expect(head).toEqual(['Line', 'Product', 'Samples Recorded', 'Samples Assessed', 'Avg Actual Height', 'Avg Actual Weight', 'Avg Load', 'Avg Compression', 'Samples Passed', 'Samples Failed', 'Sample Pass Rate']);
      expect(rowsOf(qualityWs).some(r => r[0] === 'QUALITY TEST RESULTS')).toBeFalse();
    });

    it('COMPLETE-27. complete Overall KPIs label press output for what it is — never "Production Efficiency"', () => {
      const params = buildParams({ productions: [makeProduction()] });
      const stats = (svc as any).computeStats(params);
      const rows = (svc as any).buildOverallKpiRows(stats) as string[][];
      const kpiLabels = rows.map(r => r[0]);
      expect(kpiLabels).not.toContain('Production Efficiency');
      expect(kpiLabels).toContain('Output per Press');
      const doc = (svc as any).buildPdfDoc(buildParams({ type: 'complete', format: 'pdf', productions: [makeProduction()] }));
      expect(doc.getNumberOfPages()).toBeGreaterThan(0);
      expect(doc.internal.pageSize.getWidth()).toBeLessThan(doc.internal.pageSize.getHeight());
    });

    it('COMPLETE-26. complete executive summary aggregates Released Output + Time + Cost', () => {
      const es = (svc as any).buildExcelWorkbook(buildParams({
        type: 'complete',
        productions: [makeProduction()],
        releases: [makeRelease({ releasedQuantity: 500 })],
        materials: [makeMaterial()],
        sessions: [makeSession()]
      })).Sheets['Executive Summary'] as XLSX.WorkSheet;
      expect(kpi(es, 'Total Released Output')).toBe(500);
      expect(kpi(es, 'Total Production')).toBe(80);
      expect(kpi(es, 'Total Cost')).toBe(869);
    });
  });
});