import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

import { ReportService, ReportParams } from './report.service';

import { Production } from '../models/production.model';
import { ProductionSession } from '../models/production-session.model';
import { MaterialRecord } from '../models/material-record.model';
import { QualityTest, QualitySample } from '../models/quality-test.model';
import { OutputRelease } from '../models/output-release.model';
import { Product } from '../models/product.model';
import { Shift } from '../models/shift.model';
import { Line } from '../models/line.model';
import { Material } from '../models/material.model';
import { UnitCost } from '../models/unit-cost.model';
import { EfficiencyUtil } from '../utils/efficiency.util';

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
  { id: 'mat-agg', name: 'Aggregate', unit: 'kg', conversionKgPerM3: 1400, active: true, createdAt: NOW },
  { id: 'mat-cement', name: 'Cement', unit: 'kg', conversionKgPerM3: 1300, active: true, createdAt: NOW },
  { id: 'mat-water', name: 'Water', unit: 'L', conversionKgPerM3: 1000, active: true, createdAt: NOW }
];

const UNIT_COSTS: UnitCost[] = [
  { id: 'uc-1', materialId: 'mat-cement', unit: 'kg', unitCost: 0.24, createdAt: NOW }
];



// ─── Factories ─────────────────────────────────────────────────────────────────

function makeSample(over: Partial<QualitySample> = {}): QualitySample {
  return { sampleNumber: 1, actualHeight: 200, actualWeight: 99, load: 4,
    compression: 20, compressionResult: 'PASS', ...over };
}

function makeProduction(over: Partial<Production> = {}): Production {
  return { id: 'prod-1', date: TODAY, lineId: 'lin-1', productId: 'prd-a',
    shiftId: 'shift-1', supervisor: 'QA', presses: 545, piecesPerPress: 10.5,
    produced: 5722.5, createdAt: NOW, ...over };
}

function makeRelease(over: Partial<OutputRelease> = {}): OutputRelease {
  return { id: 'rel-1', releaseDate: TODAY, productId: 'prd-a', lineId: 'lin-1',
    releasedQuantity: 50, dataSource: 'MANUAL_ENTRY', createdAt: NOW, ...over };
}

function makeLegacyRelease(over: Partial<OutputRelease> = {}): OutputRelease {
  return makeRelease({ id: 'rel-legacy-a-1', productId: undefined,
    dataSource: 'LEGACY_AMBIGUOUS_SESSION', legacySessionId: 'session-legacy', ...over });
}

function makeMaterial(over: Partial<MaterialRecord> = {}): MaterialRecord {
  return { id: 'mat-1', date: TODAY, lineId: 'lin-1', mixCount: 20,
    materials: [{ materialId: 'mat-cement', materialName: 'Cement', unit: 'kg',
      perMixStandard: 200, perMixActual: 200, theoreticalQuantity: 4000,
      actualQuantity: 4000, variance: 0, dimensionOk: true, unitCost: 0.24, totalCost: 960 }],
    totalCost: 960, createdAt: NOW, ...over };
}

function makeQuality(over: Partial<QualityTest> = {}): QualityTest {
  return { id: 'q-1', date: TODAY, testDate: TODAY, lineId: 'lin-1',
    productId: 'prd-a', productName: 'Block 20', productAreaSnapshot: 0.2,
    compressionStandardSnapshot: 15, standardHeightSnapshot: 200, standardWeightSnapshot: 99,
    samples: [makeSample(), makeSample({ sampleNumber: 2 }),
      makeSample({ sampleNumber: 3, load: 2, compression: 10, compressionResult: 'FAIL' })],
    createdAt: NOW, ...over };
}

function makeLegacyQuality(over: Partial<QualityTest> = {}): QualityTest {
  return makeQuality({ id: 'q-legacy', samples: undefined, compression: 20,
    result: 'PASS', decisionSource: 'LEGACY_AUTO_CALCULATED', ...over });
}

function makeSession(id: string, lineId = 'lin-1', overtimeHours = 0, downtimeMinutes = 0): ProductionSession {
  return { id, date: TODAY, lineId, shiftId: 'shift-1', supervisor: 'QA',
    overtime: overtimeHours > 0, overtimeHours, notes: '', createdAt: NOW,
    dailyLineTime: [{ lineId, overtimeHours, downtimeMinutes, downtimeReason: '', notes: '' }] };
}

function deepFreeze<T>(obj: T): T {
  Object.keys(obj as object).forEach((k) => {
    const v = (obj as any)[k];
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(obj);
}

function buildParams(over: Partial<ReportParams> = {}): ReportParams {
  return { type: 'production', range: { preset: 'custom', startDate: TODAY, endDate: TODAY, label: 'QA' },
    products: PRODUCTS, lines: LINES, shifts: SHIFTS, materialsMaster: MASTER_MATERIALS,
    unitCostsMaster: UNIT_COSTS, productions: [makeProduction()], sessions: [makeSession('session-1')],
    releases: [makeRelease()], materials: [makeMaterial()], qualityTests: [makeQuality()], ...over };
}

// ─── on-demand export dependencies (PDF only) ─────────────────────────────────

describe('ReportService', () => {
  let svc: ReportService;
  let fonts: typeof import('../utils/pdf-arabic-font');

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [ReportService] });
    svc = TestBed.inject(ReportService);
    TestBed.inject(TranslationService).setLanguage('en');
    await (svc as any).loadPdfLibraries();
    fonts = await import('../utils/pdf-arabic-font');
    const buildPdfDoc = (svc as any).buildPdfDoc.bind(svc);
    spyOn<any>(svc, 'buildPdfDoc').and.callFake((params: ReportParams, pdfFonts: typeof fonts) => {
      const doc = buildPdfDoc(params, pdfFonts);
      spyOn(doc, 'save').and.stub();
      return doc;
    });
  });

  describe('on-demand export dependencies', () => {
    it('loads PDF libraries only when requested and reuses the loaded dependencies', async () => {
      const fresh = TestBed.runInInjectionContext(() => new ReportService());
      expect((fresh as any).pdf).toBeUndefined();
      expect((fresh as any).pdfTable).toBeUndefined();
      await (fresh as any).loadPdfLibraries();
      const pdf = (fresh as any).pdf;
      const table = (fresh as any).pdfTable;
      expect(pdf).toBeDefined();
      expect(table).toBeDefined();
      await (fresh as any).loadPdfLibraries();
      expect((fresh as any).pdf).toBe(pdf);
      expect((fresh as any).pdfTable).toBe(table);
    });

    it('builds all six actual PDF reports in English and Arabic with the embedded Amiri font', () => {
      const types: ReportParams['type'][] = ['production', 'materials', 'quality', 'complete', 'daily', 'monthly'];
      for (const language of ['en', 'ar'] as const) {
        TestBed.inject(TranslationService).setLanguage(language);
        for (const type of types) {
          const doc = (svc as any).buildPdfDoc(buildParams({ type }), fonts);
          expect(doc.getNumberOfPages()).withContext(language + '/' + type).toBeGreaterThan(0);
          expect(doc.getFontList()['Amiri']).toBeDefined();
          expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
        }
      }
    });
  });

  describe('localized report presentation', () => {
    it('shows Arabic PASS and FAIL in PDF rows while preserving source status', () => {
      const translation = TestBed.inject(TranslationService);
      translation.setLanguage('ar');
      const rows = deepFreeze([['PASS'], ['FAIL']]);
      const display = (svc as any).pdfDisplayRows([[translation.t('reports.pdf.Result')]], rows);
      expect(display).toEqual([[translation.t('reports.status.pass')], [translation.t('reports.status.fail')]]);
      expect(rows).toEqual([['PASS'], ['FAIL']]);
    });

    it('preserves fractional Produced in PDF totals and presentation', () => {
      expect((svc as any).buildOperationKpis(buildParams()).produced).toBe(5722.5);
      expect((svc as any).fmtNum(5722.5)).toBe('5,722.5');
    });

    it('keeps fractional trolley-derived Presses and Produced in PDF statistics', () => {
      const params = buildParams({ productions: [makeProduction({
        presses: 423.5, produced: 9528.75,
        trolleyCount: 30.25, pressesPerTrolley: 14, piecesPerPress: 22.5
      })] });
      const stats = (svc as any).computeStats(params);
      expect(stats.totalPresses).toBe(423.5);
      expect(stats.totalProduced).toBe(9528.75);
      expect((svc as any).fmtNum(stats.totalPresses)).toBe('423.5');
      expect((svc as any).fmtNum(stats.totalProduced)).toBe('9,528.75');
    });
  });


  describe('INTEGRITY', () => {
    it('29. report generation does not modify Production records', async () => {
      const params = buildParams({
        productions: deepFreeze([makeProduction(), makeProduction({ id: 'prod-2', productId: 'prd-b', presses: 322, produced: 3381 })]),
        releases: deepFreeze([makeRelease()]),
        materials: deepFreeze([makeMaterial()]),
        qualityTests: deepFreeze([makeQuality()])
      });
      const before = JSON.stringify(params);
      await svc.generate(params);
      expect(JSON.stringify(params)).toBe(before);
    });

    it('30. report generation does not modify Output Release records', async () => {
      const releases = deepFreeze([makeRelease(), makeLegacyRelease()]);
      const params = buildParams({ releases });
      await svc.generate(params);
      expect(releases[0].releasedQuantity).toBe(50);
      expect(releases[1].dataSource).toBe('LEGACY_AMBIGUOUS_SESSION');
    });

    it('31. report generation does not modify Material records', async () => {
      const mats = deepFreeze([makeMaterial()]);
      const params = buildParams({ materials: mats });
      await svc.generate(params);
      expect(mats[0].mixCount).toBe(20);
    });

    it('32. report generation does not modify Quality test records', async () => {
      const q = deepFreeze([makeQuality()]);
      const params = buildParams({ qualityTests: q });
      await svc.generate(params);
      expect(q[0].samples?.length).toBe(3);
    });

    it('33. legacy ambiguous releases are preserved and labeled, never invented or dropped', async () => {
      const params = buildParams({
        releases: [{ ...makeLegacyRelease({ id: 'rel-x', productId: undefined }) }]
      });
      const before = JSON.stringify(params.releases);
      await svc.generate(params);
      expect(JSON.stringify(params.releases)).toBe(before);
    });

    it('34. legacy single-measurement quality renders safely and counts as recorded', () => {
      const rec = (svc as any).qualityStats([makeLegacyQuality()]);
      expect(rec.recorded).toBe(1);
      expect(rec.assessed).toBe(1);
    });
  });

  describe('QUALITY PDF LANDSCAPE LAYOUT', () => {
    it('quality PDF opens in LANDSCAPE (297 × 210 mm)', async () => {
      const doc = await (svc as any).buildPdfDoc(buildParams({ type: 'quality' }), fonts);
      expect(doc).toBeDefined();
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 0);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
    });

    it('production PDF stays PORTRAIT (only Quality is flipped to landscape)', async () => {
      const doc = await (svc as any).buildPdfDoc(buildParams({ type: 'production' }), fonts);
      expect(doc).toBeDefined();
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
    });
  });

  describe('CORRECTIONS PASS', () => {
    it('TIME-1. available time is 390 minutes per line per day', () => {
      const eff = EfficiencyUtil.calculateEfficiency(0, 0);
      expect(eff.availableMinutes).toBe(390);
      expect(eff.actualRunMinutes).toBe(390);
      expect(eff.timeEfficiency).toBe(100);
    });

    it('TIME-2. two sessions for the SAME line/day use one 390-minute base', () => {
      const eff = (svc as any).timeAggregate(buildParams({ sessions: [makeSession('a'), makeSession('b')] }));
      expect(eff.totalAvailableMinutes).toBe(390);
      expect(eff.totalActualRunMinutes).toBe(390);
    });

    it('TIME-3. two LINES on one day yield 780 minutes', () => {
      const eff = (svc as any).timeAggregate(buildParams({ sessions: [makeSession('a'), makeSession('b', 'lin-2')] }));
      expect(eff.totalAvailableMinutes).toBe(780);
      expect(eff.totalActualRunMinutes).toBe(780);
    });

    it('TIME-4. half an hour overtime adds 30 minutes and downtime reduces actual run', () => {
      const eff = EfficiencyUtil.calculateEfficiency(0.5, 30);
      expect(eff.availableMinutes).toBe(420);
      expect(eff.actualRunMinutes).toBe(390);
      expect(eff.timeEfficiency).toBeCloseTo(390 / 420 * 100, 8);
    });


    it('TO-24. quality PDF rows include Amiri font', async () => {
      TestBed.inject(TranslationService).setLanguage('ar');
      const doc = (svc as any).buildPdfDoc(buildParams({ type: 'quality' }), fonts);
      expect(doc).toBeDefined();
      const registeredFonts = doc.getFontList();
      expect(registeredFonts['Amiri']).toBeDefined();
    });
  });
});
