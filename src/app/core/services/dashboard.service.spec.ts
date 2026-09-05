import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DashboardService, DashboardData, DateRange } from './dashboard.service';
import { ProductionService } from './production.service';
import { ProductionSessionService } from './production-session.service';
import { MaterialsService } from './materials.service';
import { MaterialService } from './material.service';
import { OutputReleaseService } from './output-release.service';
import { UnitCostService } from './unit-cost.service';
import { QualityService } from './quality.service';
import { ProductService } from './product.service';
import { ShiftService } from './shift.service';
import { LineService } from './line.service';

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

const NOW = '2026-08-30T08:00:00.000Z';
const TODAY = '2026-08-30';

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

/** Three-sample event. Sample 3 can be forced to FAIL or CONFIGURATION_REQUIRED. */
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

function baseData(): DashboardData {
  return {
    productions: [],
    sessions: [],
    materials: [],
    qualityTests: [],
    releases: [],
    products: PRODUCTS,
    shifts: SHIFTS,
    lines: LINES,
    materialsMaster: MASTER_MATERIALS,
    unitCostsMaster: []
  };
}

function makeUnitCost(overrides: Partial<UnitCost> = {}): UnitCost {
  return {
    id: 'cst-1', materialId: 'mat-1', unitCost: 15, unit: 'per ton', demo: false, createdAt: NOW, ...overrides
  };
}

function todayRange(): DateRange {
  return { preset: 'today', startDate: TODAY, endDate: TODAY, label: 'Today' };
}

// ─── Test Bed ────────────────────────────────────────────────────────────────

describe('DashboardService', () => {
  let svc: DashboardService;

  const mockSvc = (name: string, records: any[]) => ({ getAll: jasmine.createSpy(name).and.returnValue(of(records)) });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DashboardService,
        { provide: ProductionService, useValue: mockSvc('ProductionService.getAll', []) },
        { provide: ProductionSessionService, useValue: mockSvc('ProductionSessionService.getAll', []) },
        { provide: MaterialsService, useValue: mockSvc('MaterialsService.getAll', []) },
        { provide: MaterialService, useValue: mockSvc('MaterialService.getAll', []) },
        { provide: OutputReleaseService, useValue: mockSvc('OutputReleaseService.getAll', []) },
        { provide: QualityService, useValue: mockSvc('QualityService.getAll', []) },
        { provide: ProductService, useValue: mockSvc('ProductService.getAll', []) },
        { provide: ShiftService, useValue: mockSvc('ShiftService.getAll', []) },
        { provide: LineService, useValue: mockSvc('LineService.getAll', []) },
        { provide: UnitCostService, useValue: mockSvc('UnitCostService.getAll', []) }
      ]
    });
    svc = TestBed.inject(DashboardService);
  });

  // ─── Date handling ─────────────────────────────────────────────────────────

  it('regression 17: local calendar date grouping — no UTC shifting', () => {
    const today = svc.localDateStr(new Date());
    const range = svc.buildDateRange('today');
    expect(range.startDate).toBe(today);
    expect(range.endDate).toBe(today);

    const data = baseData();
    data.productions = [
      makeProduction({ date: today }),
      makeProduction({ id: 'prod-old', date: '2026-08-28' })
    ];
    const filtered = svc.filterData(data, range);
    expect(filtered.productions.length).toBe(1);
    expect(filtered.productions[0].date).toBe(today);

    const trend = svc.buildProductionTrend([makeProduction({ date: today })], range);
    const [y, m, d] = today.split('-').map(Number);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const todayLabel = `${monthNames[m - 1]} ${d}`;
    const todayPoint = trend.find(t => t.label === todayLabel);
    expect(todayPoint?.value).toBe(80);
  });

  it('regression 18: dashboard reads never mutate source transactions', () => {
    const prods = [makeProduction(), makeProduction({ id: 'prod-2', presses: 5, produced: 40, productId: 'prd-b' })];
    const releases = [makeRelease()];
    const mats = [makeMaterial()];
    const qts = [makeQuality()];
    const before = JSON.stringify({ prods, releases, mats, qts });

    svc.calcStats({ ...baseData(), productions: prods, releases, materials: mats, qualityTests: qts });
    svc.buildProductionByProduct(prods, PRODUCTS);
    svc.buildProductPerformance(prods, releases, PRODUCTS);
    svc.buildMaterialAggregates(mats, MASTER_MATERIALS);
    svc.buildQualityTrend(qts, todayRange());
    svc.buildLineStatus({ productions: prods, releases, materials: mats, qualityTests: qts, sessions: [makeSession()], lines: LINES, products: PRODUCTS });
    svc.buildAlerts({ productions: prods, materials: mats, materialsMaster: MASTER_MATERIALS, products: PRODUCTS, qualityTests: qts });

    expect(JSON.stringify({ prods, releases, mats, qts })).toBe(before);
  });

  // ─── Production by Product regressions ─────────────────────────────────────

  it('regressions 1+2: same Product aggregates; multiple Products stay separate', () => {
    const prods = [
      makeProduction(),
      makeProduction({ id: 'prod-2', presses: 5, produced: 40 }),
      makeProduction({ id: 'prod-3', productId: 'prd-b', presses: 3, produced: 24 })
    ];
    const byProduct = svc.buildProductionByProduct(prods, PRODUCTS);
    expect(byProduct.length).toBe(2);
    const block20 = byProduct.find(r => r.productName === 'Block 20');
    expect(block20?.produced).toBe(120);
  });

  it('regressions 3+4: presses and produced aggregate by Product', () => {
    const prods = [
      makeProduction({ presses: 10, produced: 80 }),
      makeProduction({ id: 'prod-2', presses: 5, produced: 40 })
    ];
    const perf = svc.buildProductPerformance(prods, [], PRODUCTS);
    expect(perf.length).toBe(1);
    expect(perf[0].productName).toBe('Block 20');
    expect(perf[0].presses).toBe(15);
    expect(perf[0].produced).toBe(120);
    expect(perf[0].releasedOutput).toBe(0);
  });

  it('regressions 5+6: Released Output is independent; same Line/date different Product supported', () => {
    const prods = [makeProduction()]; // Block 20 pressed on lin-1
    const releases = [makeRelease()]; // Block 15 released on lin-1 same date
    const perf = svc.buildProductPerformance(prods, releases, PRODUCTS);

    const block20 = perf.find(r => r.productName === 'Block 20');
    const block15 = perf.find(r => r.productName === 'Block 15');
    expect(block20?.produced).toBe(80);
    expect(block20?.releasedOutput).toBe(0);
    expect(block15?.produced).toBe(0);
    expect(block15?.releasedOutput).toBe(500);
  });

  it('released output is date-filtered by releaseDate in filterData', () => {
    const data = baseData();
    data.releases = [makeRelease(), makeRelease({ id: 'rel-old', releaseDate: '2026-08-01' })];
    const filtered = svc.filterData(data, todayRange());
    expect(filtered.releases.length).toBe(1);
  });

  // ─── Materials regressions 7–10 ────────────────────────────────────────────

  it('regression 7: materials consumed from approved records (MixCount × Actual Per Mix), not Presses', () => {
    const prods = [makeProduction({ presses: 10, produced: 80 })];
    const mats = [makeMaterial()];

    const stats = svc.calcStats({ ...baseData(), productions: prods, materials: mats });
    expect(stats.totalMixes).toBe(20); // NOT 10 presses

    const agg = svc.buildMaterialAggregates(mats, MASTER_MATERIALS);
    const sand = agg.find(a => a.material === 'Sand');
    expect(sand?.actualQuantity).toBe(7600); // 20 mixes × 380 kg
    expect(sand?.theoreticalQuantity).toBe(0);
  });

  it('regressions 8+9: Sand/Aggregate kg → m³ use configured conversions', () => {
    const agg = svc.buildMaterialAggregates([makeMaterial()], MASTER_MATERIALS);
    const sand = agg.find(a => a.material === 'Sand');
    const aggregate = agg.find(a => a.material === 'Aggregate');
    expect(sand?.cubicMeters).toBeCloseTo(4.75, 2); // 7600 / 1600
    expect(sand?.conversionStatus).toBe('OK');
    expect(aggregate?.cubicMeters).toBeCloseTo(7.3571, 2); // 10300 / 1400
    expect(aggregate?.conversionStatus).toBe('OK');
  });

  it('regression 10: missing conversion → CONFIGURATION REQUIRED, no fabricated m³', () => {
    const masterNoSand = MASTER_MATERIALS.filter(m => m.id !== 'mat-sand');
    const agg = svc.buildMaterialAggregates([makeMaterial()], masterNoSand);
    const sand = agg.find(a => a.material === 'Sand');
    expect(sand?.cubicMeters).toBe(0);
    expect(sand?.conversionStatus).toBe(CONFIGURATION_REQUIRED);

    const alerts = svc.buildAlerts({ productions: [], materials: [makeMaterial()], materialsMaster: masterNoSand, products: PRODUCTS, qualityTests: [] });
    expect(alerts.some(a => a.title.includes('Sand conversion not configured'))).toBeTrue();
  });

  it('Water needs no conversion', () => {
    const agg = svc.buildMaterialAggregates([makeMaterial()], MASTER_MATERIALS);
    const water = agg.find(a => a.material === 'Water');
    expect(water?.conversionStatus).toBe('OK');
    expect(water?.cubicMeters).toBe(0);
  });

  // ─── Quality three-sample regressions 11–16 ────────────────────────────────

  it('regressions 11+12: three-sample Avg Compression uses sample values (never 0 from legacy fields)', () => {
    const qts = [makeQuality()];
    const trend = svc.buildQualityTrend(qts, todayRange());
    const point = trend.find(t => t.label === 'Aug 30');
    expect(point?.count).toBe(1);
    expect(point?.avgCompression).toBe(16); // (16+16+16)/3
  });

  it('regression 13: sample PASS/FAIL counts and Sample Pass Rate are per-sample', () => {
    const failSample = makeSample({ sampleNumber: 3, load: 2.6 });
    failSample.compression = QualityCalculationUtil.calculateCompression(2.6, 0.2) as number;
    failSample.compressionResult = QualityCalculationUtil.evaluate(failSample.compression, 15);
    const qts = [makeQuality({ samples: [makeSample({ sampleNumber: 1 }), makeSample({ sampleNumber: 2 }), failSample] })];

    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualitySamples).toBe(3);
    expect(stats.qualityPassed).toBe(2);
    expect(stats.qualityFailed).toBe(1);
    expect(stats.passRate).toBeCloseTo(66.7, 1);
  });

  it('regression 14: stats count samples, not events — no invented overall event PASS/FAIL', () => {
    const qts = [makeQuality(), makeQuality({ id: 'qt-2', submissionId: 'qt-2' })];
    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualitySamples).toBe(6); // 2 events × 3 samples
    expect(stats.qualityPassed).toBe(6);
    expect(stats.qualityFailed).toBe(0);
  });

  it('regression 15: no Height/Weight PASS/FAIL invented — quality KPIs derive only from compressionResult', () => {
    // Samples with height/weight differences but NO pass/fail concept for them.
    const qts = [makeQuality()];
    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualityPassed).toBe(3);
    expect(stats.qualityFailed).toBe(0);
    // Any non-evaluated sample must surface as CONFIGURATION_REQUIRED, counted as neither passed nor failed.
    const configSample = makeSample({ compressionResult: CONFIGURATION_REQUIRED, compression: undefined as unknown as number });
    const configQts = [makeQuality({ samples: [makeSample({ sampleNumber: 1 }), makeSample({ sampleNumber: 2 }), configSample] })];
    const cfgStats = svc.calcStats({ ...baseData(), qualityTests: configQts });
    expect(cfgStats.qualitySamples).toBe(3);
    expect(cfgStats.qualityPassed).toBe(2);
    expect(cfgStats.qualityFailed).toBe(0);
  });

  // ─── Quality pass-rate denominator (Assessed = Passed + Failed) ────────────

  it('dash PASS-RATE case 1: 2 passed + 1 failed → assessed 3, pass rate 66.67%', () => {
    const failSample = makeSample({ sampleNumber: 3, load: 2.6 });
    failSample.compression = QualityCalculationUtil.calculateCompression(2.6, 0.2) as number;
    failSample.compressionResult = QualityCalculationUtil.evaluate(failSample.compression, 15);
    const qts = [makeQuality({ samples: [makeSample({ sampleNumber: 1 }), makeSample({ sampleNumber: 2 }), failSample] })];

    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualitySamples).toBe(3);
    expect(stats.qualityPassed).toBe(2);
    expect(stats.qualityFailed).toBe(1);
    expect(stats.qualityPassed + stats.qualityFailed).toBe(3); // assessed
    expect(stats.passRate).toBeCloseTo(66.67, 2);
  });

  it('dash PASS-RATE case 2: 2 passed + 0 failed + 1 CONFIGURATION_REQUIRED → assessed 2, pass rate 100%', () => {
    const configSample = makeSample({ compressionResult: CONFIGURATION_REQUIRED, compression: undefined as unknown as number });
    const qts = [makeQuality({ samples: [makeSample({ sampleNumber: 1 }), makeSample({ sampleNumber: 2 }), configSample] })];

    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualitySamples).toBe(3); // recorded count unchanged
    expect(stats.qualityPassed).toBe(2);
    expect(stats.qualityFailed).toBe(0);
    expect(stats.qualityPassed + stats.qualityFailed).toBe(2); // assessed
    expect(stats.passRate).toBe(100); // CONFIGURATION_REQUIRED NOT in denominator
  });

  it('dash PASS-RATE case 3: 0 passed + 0 failed + 3 CONFIGURATION_REQUIRED → assessed 0, pass rate 0 (no NaN/Infinity)', () => {
    const configSample = (n: number) => makeSample({ sampleNumber: n, compressionResult: CONFIGURATION_REQUIRED, compression: undefined as unknown as number });
    const qts = [makeQuality({ samples: [configSample(1), configSample(2), configSample(3)] })];

    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualitySamples).toBe(3);
    expect(stats.qualityPassed).toBe(0);
    expect(stats.qualityFailed).toBe(0);
    expect(stats.qualityPassed + stats.qualityFailed).toBe(0); // assessed
    expect(stats.passRate).toBe(0);
    expect(Number.isFinite(stats.passRate)).toBeTrue();
    expect(Number.isNaN(stats.passRate)).toBeFalse();
  });

  it('dash PASS-RATE case 4: 3 passed → assessed 3, pass rate 100%', () => {
    const qts = [makeQuality()];

    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualitySamples).toBe(3);
    expect(stats.qualityPassed).toBe(3);
    expect(stats.qualityFailed).toBe(0);
    expect(stats.qualityPassed + stats.qualityFailed).toBe(3); // assessed
    expect(stats.passRate).toBe(100);
  });

  it('dash PASS-RATE: CONFIGURATION_REQUIRED does not reduce a fully-passing denominator', () => {
    const configSample = makeSample({ compressionResult: CONFIGURATION_REQUIRED, compression: undefined as unknown as number });
    const qts = [makeQuality({ samples: [makeSample({ sampleNumber: 1 }), makeSample({ sampleNumber: 2 }), configSample] })];

    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.passRate).toBe(100);
    expect(stats.qualitySamples).toBe(3); // still reported as 3 recorded samples
  });

  it('regression 16: Time Efficiency uses the authoritative EfficiencyUtil only', () => {
    const sessions = [makeSession()];
    const expected = EfficiencyUtil.calculateAggregateEfficiency(sessions[0].dailyLineTime).timeEfficiency;
    const stats = svc.calcStats({ ...baseData(), sessions });
    expect(stats.timeEfficiency).toBe(expected);

    const lineStatus = svc.buildLineStatus({ productions: [], releases: [], materials: [], qualityTests: [], sessions, lines: LINES, products: PRODUCTS });
    expect(lineStatus.length).toBe(1);
    expect(lineStatus[0].timeEfficiency).toBe(expected);
    expect(lineStatus[0].downtimeMinutes).toBe(30);
  });

  it('legacy single-measurement quality events still count as one sample (backward compat)', () => {
    const legacyFactory = ({ id, compression, result }: any) => ({
      id, date: TODAY, productId: 'prd-a', productName: 'Block 20', lineId: 'lin-1',
      testDate: TODAY, compression, result, createdAt: NOW
    });
    const qts = [
      legacyFactory({ id: 'L1', compression: 16, result: 'PASS' }),
      legacyFactory({ id: 'L2', compression: 14, result: 'FAIL' })
    ];
    const stats = svc.calcStats({ ...baseData(), qualityTests: qts });
    expect(stats.qualitySamples).toBe(2);
    expect(stats.qualityPassed).toBe(1);
    expect(stats.qualityFailed).toBe(1);

    const trend = svc.buildQualityTrend(qts, todayRange());
    const point = trend.find(t => t.label === 'Aug 30');
    expect(point?.avgCompression).toBe(15); // (16+14)/2
  });

  // ─── Line Status ───────────────────────────────────────────────────────────

  it('line status shows multi-product breakdown, presses/produced/released/mixes/downtime/quality', () => {
    const data = baseData();
    data.productions = [
      makeProduction(),
      makeProduction({ id: 'prod-b1', productId: 'prd-b', presses: 3, produced: 24 })
    ];
    data.releases = [makeRelease()];
    data.materials = [makeMaterial()];
    data.qualityTests = [makeQuality()];
    data.sessions = [makeSession()];

    const rows = svc.buildLineStatus(data);
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.lineName).toBe('Line 1 - Heavy');
    expect(row.products.length).toBe(2); // Block 20 + Block 15 released
    const block20 = row.products.find(p => p.productName === 'Block 20');
    expect(block20?.produced).toBe(80);
    const block15 = row.products.find(p => p.productName === 'Block 15');
    expect(block15?.releasedOutput).toBe(500);
    expect(row.presses).toBe(13);
    expect(row.produced).toBe(104);
    expect(row.releasedOutput).toBe(500);
    expect(row.mixCount).toBe(20);
    expect(row.downtimeMinutes).toBe(30);
    expect(row.qualitySamples).toBe(3);
    expect(row.qualityPassed).toBe(3);
  });

  // ─── Alerts ────────────────────────────────────────────────────────────────

  it('alerts: Production exists but Materials missing for the same Line', () => {
    const alerts = svc.buildAlerts({
      productions: [makeProduction()],
      materials: [],
      materialsMaster: MASTER_MATERIALS,
      products: PRODUCTS,
      qualityTests: []
    });
    expect(alerts.some(a => a.title === 'Production recorded, Materials missing')).toBeTrue();
  });

  it('alerts: incomplete Product master (missing Area / Compression Standard / Height / Weight)', () => {
    const bareProduct: Product = { id: 'prd-c', name: 'Bare', standardStrength: 0, active: true, createdAt: NOW };
    const alerts = svc.buildAlerts({
      productions: [makeProduction({ productId: 'prd-c' })],
      materials: [],
      materialsMaster: MASTER_MATERIALS,
      products: [bareProduct],
      qualityTests: []
    });
    const productAlert = alerts.find(a => a.title.includes('Product configuration incomplete: Bare'));
    expect(productAlert).toBeDefined();
    expect(productAlert?.description).toContain('Area');
    expect(productAlert?.description).toContain('Compression Standard');
    expect(productAlert?.description).toContain('Standard Height');
    expect(productAlert?.description).toContain('Standard Weight');
  });

  it('alerts: incomplete Quality configuration (CONFIGURATION_REQUIRED samples)', () => {
    const configSample = makeSample({ compressionResult: CONFIGURATION_REQUIRED, compression: undefined as unknown as number });
    const alerts = svc.buildAlerts({
      productions: [],
      materials: [],
      materialsMaster: MASTER_MATERIALS,
      products: PRODUCTS,
      qualityTests: [makeQuality({ samples: [makeSample({ sampleNumber: 1 }), makeSample({ sampleNumber: 2 }), configSample] })]
    });
    expect(alerts.some(a => a.title === 'Quality configuration incomplete')).toBeTrue();
  });

  it('no fabricated alerts when everything is configured and matched', () => {
    const alerts = svc.buildAlerts({
      productions: [makeProduction()],
      materials: [makeMaterial()],
      materialsMaster: MASTER_MATERIALS,
      products: PRODUCTS,
      qualityTests: [makeQuality()]
    });
    expect(alerts).toEqual([]);
  });

  // ─── loadAll wiring ────────────────────────────────────────────────────────

  it('loadAll gathers releases + materials master alongside core stores', () => {
    const spySvc = (token: any, records: any[]) => {
      const s = TestBed.inject(token) as any;
      (s.getAll as jasmine.Spy).and.returnValue(of(records));
      return s;
    };
    spySvc(ProductionService, [makeProduction()]);
    spySvc(ProductionSessionService, [makeSession()]);
    spySvc(MaterialsService, [makeMaterial()]);
    spySvc(MaterialService, MASTER_MATERIALS);
    spySvc(OutputReleaseService, [makeRelease()]);
    spySvc(QualityService, [makeQuality()]);
    spySvc(ProductService, PRODUCTS);
    spySvc(ShiftService, SHIFTS);
    spySvc(LineService, LINES);
    spySvc(UnitCostService, [makeUnitCost()]);

    let data: DashboardData | undefined;
    svc.loadAll().subscribe(d => { data = d; });
    expect(data).toBeDefined();
    expect(data!.releases.length).toBe(1);
    expect(data!.materialsMaster.length).toBe(3);
    expect(data!.productions.length).toBe(1);
    expect(data!.unitCostsMaster.length).toBe(1);
  });
});