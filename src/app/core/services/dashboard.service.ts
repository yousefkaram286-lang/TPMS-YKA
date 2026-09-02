import { Injectable, inject } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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
import { EfficiencyUtil } from '../utils/efficiency.util';
import { MaterialConversionUtil, OK, CONFIGURATION_REQUIRED } from '../utils/material-conversion.util';
import { QualityCalculationUtil } from '../utils/quality-calculation.util';

import { Production } from '../models/production.model';
import { ProductionSession } from '../models/production-session.model';
import { MaterialRecord, MaterialTransactionItem } from '../models/material-record.model';
import { QualityTest, QualitySample } from '../models/quality-test.model';
import { Product } from '../models/product.model';
import { Shift } from '../models/shift.model';
import { Line } from '../models/line.model';
import { OutputRelease } from '../models/output-release.model';
import { Material } from '../models/material.model';
import { UnitCost } from '../models/unit-cost.model';

export type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export interface DateRange {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
}

export interface DashboardData {
  productions: Production[];
  sessions: ProductionSession[];
  materials: MaterialRecord[];
  qualityTests: QualityTest[];
  releases: OutputRelease[];
  products: Product[];
  shifts: Shift[];
  lines: Line[];
  materialsMaster: Material[];
  unitCostsMaster: UnitCost[];
}

export interface DashboardStats {
  totalProduction: number;
  totalMixes: number;
  qualitySamples: number;
  qualityPassed: number;
  qualityFailed: number;
  passRate: number;
  totalCost: number;
  timeEfficiency: number;
}

export interface ProductionTrendPoint {
  label: string;
  value: number;
}

export interface ProductBreakdown {
  productName: string;
  produced: number;
}

/**
 * Production vs Released Output comparison for one Product.
 * Independent transactions — NO genealogy is implied between them.
 */
export interface ProductPerformanceRow {
  productName: string;
  presses: number;
  produced: number;
  releasedOutput: number;
}

/** One line raised in the Line Status view. */
export interface LineProductRow {
  productName: string;
  presses: number;
  produced: number;
  releasedOutput: number;
}

export interface LineStatusRow {
  lineId: string;
  lineName: string;
  products: LineProductRow[];
  presses: number;
  produced: number;
  releasedOutput: number;
  mixCount: number;
  downtimeMinutes: number;
  overtimeHours: number;
  timeEfficiency: number;
  qualitySamples: number;
  qualityPassed: number;
  qualityFailed: number;
  hasProduction: boolean;
  hasRelease: boolean;
  hasMaterials: boolean;
  hasQuality: boolean;
}

export interface MaterialAggregate {
  material: string;
  unit: string;
  theoreticalQuantity: number;
  actualQuantity: number;
  variance: number;
  totalCost: number;
  /** Report/display-only kg → m³ preview using the configured factor. */
  cubicMeters: number;
  conversionStatus: typeof OK | typeof CONFIGURATION_REQUIRED;
}

export interface OperationalAlert {
  severity: 'info' | 'warning' | 'danger';
  icon: string;
  title: string;
  description: string;
}

export interface QualityTrendPoint {
  label: string;
  /** Daily average of per-event average Compression (three-sample aware). */
  avgCompression: number;
  count: number;
}

export interface RecentActivity {
  type: 'production' | 'materials' | 'quality';
  icon: string;
  title: string;
  description: string;
  timestamp: Date;
  relativeTime: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private productionService = inject(ProductionService);
  private productionSessionService = inject(ProductionSessionService);
  private materialsService = inject(MaterialsService);
  private materialService = inject(MaterialService);
  private outputReleaseService = inject(OutputReleaseService);
  private qualityService = inject(QualityService);
  private productService = inject(ProductService);
  private shiftService = inject(ShiftService);
  private lineService = inject(LineService);
  private unitCostService = inject(UnitCostService);

  // ─── Date Range Helpers ──────────────────────────────────────────────────

  getPresets(): { preset: DatePreset; label: string }[] {
    return [
      { preset: 'today', label: 'Today' },
      { preset: 'last7', label: 'Last 7 Days' },
      { preset: 'last30', label: 'Last 30 Days' },
      { preset: 'thisMonth', label: 'This Month' },
      { preset: 'custom', label: 'Custom Range' }
    ];
  }

  buildDateRange(preset: DatePreset, customStart?: string, customEnd?: string): DateRange {
    const today = this.localDateStr(new Date());
    const label = this.getPresets().find(p => p.preset === preset)?.label ?? preset;

    switch (preset) {
      case 'today':
        return { preset, startDate: today, endDate: today, label };

      case 'last7': {
        const start = this.offsetDays(new Date(), -6);
        return { preset, startDate: this.localDateStr(start), endDate: today, label };
      }

      case 'last30': {
        const start = this.offsetDays(new Date(), -29);
        return { preset, startDate: this.localDateStr(start), endDate: today, label };
      }

      case 'thisMonth': {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        return { preset, startDate: this.localDateStr(first), endDate: today, label };
      }

      case 'custom':
        return {
          preset,
          startDate: customStart ?? today,
          endDate: customEnd ?? today,
          label: customStart && customEnd ? `${customStart} → ${customEnd}` : label
        };
    }
  }

  localDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private offsetDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  // Extracts date part from ISO strings or plain YYYY-MM-DD
  extractDateStr(value: string): string {
    if (!value) return '';
    return value.substring(0, 10);
  }

  inRange(recordDate: string, range: DateRange): boolean {
    const d = this.extractDateStr(recordDate);
    return d >= range.startDate && d <= range.endDate;
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────

  loadAll(): Observable<DashboardData> {
    return forkJoin({
      productions: this.productionService.getAll().pipe(catchError(() => of([] as Production[]))),
      sessions:    this.productionSessionService.getAll().pipe(catchError(() => of([] as ProductionSession[]))),
      materials:   this.materialsService.getAll().pipe(catchError(() => of([] as MaterialRecord[]))),
      qualityTests: this.qualityService.getAll().pipe(catchError(() => of([] as QualityTest[]))),
      releases:    this.outputReleaseService.getAll().pipe(catchError(() => of([] as OutputRelease[]))),
      products:    this.productService.getAll().pipe(catchError(() => of([] as Product[]))),
      shifts:      this.shiftService.getAll().pipe(catchError(() => of([] as Shift[]))),
      lines:       this.lineService.getAll().pipe(catchError(() => of([] as Line[]))),
      materialsMaster: this.materialService.getAll().pipe(catchError(() => of([] as Material[]))),
      unitCostsMaster: this.unitCostService.getAll().pipe(catchError(() => of([] as UnitCost[])))
    });
  }

  filterData(data: DashboardData, range: DateRange): DashboardData {
    return {
      ...data,
      productions:  data.productions.filter(p => this.inRange(p.date, range)),
      sessions:     data.sessions.filter(s => this.inRange(s.date, range)),
      materials:    data.materials.filter(m => this.inRange(m.date, range)),
      qualityTests: data.qualityTests.filter(q => this.inRange(q.date, range)),
      releases:     data.releases.filter(r => this.inRange(r.releaseDate, range))
    };
  }

  // ─── KPI Aggregations ─────────────────────────────────────────────────────

  calcStats(filtered: DashboardData): DashboardStats {
    const totalProduction = filtered.productions.reduce((s, p) => s + (p.produced || 0), 0);
    const totalMixes      = filtered.materials.reduce((s, m) => s + (m.mixCount || 0), 0);

    // Quality is measured per SAMPLE. Three-sample events count every stored
    // sample; legacy single-measurement events count as one sample.
    let qualitySamples = 0;
    let qualityPassed  = 0;
    let qualityFailed  = 0;
    filtered.qualityTests.forEach(q => {
      const samples = (q.samples || []).filter(s => s);
      if (samples.length > 0) {
        samples.forEach(s => {
          qualitySamples++;
          if (s.compressionResult === 'PASS')      qualityPassed++;
          else if (s.compressionResult === 'FAIL') qualityFailed++;
        });
      } else {
        qualitySamples++;
        if (q.result === 'PASS')      qualityPassed++;
        else if (q.result === 'FAIL') qualityFailed++;
      }
    });

    const passRate = qualitySamples > 0 ? (qualityPassed / qualitySamples) * 100 : 0;
    const totalCost = filtered.materials.reduce((s, m) => s + (m.totalCost || 0), 0);

    // Calculate Efficiency
    const lineEntries: { overtimeHours?: number, downtimeMinutes?: number }[] = [];
    filtered.sessions.forEach(s => {
      s.dailyLineTime?.forEach(d => {
        lineEntries.push(d);
      });
    });
    const eff = EfficiencyUtil.calculateAggregateEfficiency(lineEntries);

    return { totalProduction, totalMixes, qualitySamples, qualityPassed, qualityFailed, passRate, totalCost, timeEfficiency: eff.timeEfficiency };
  }

  // ─── Chart Data Builders ──────────────────────────────────────────────────

  buildProductionTrend(productions: Production[], range: DateRange): ProductionTrendPoint[] {
    const map = new Map<string, number>();

    // Pre-populate all dates in range so gaps show as 0
    let cur = new Date(range.startDate);
    const end = new Date(range.endDate);
    while (cur <= end) {
      map.set(this.localDateStr(cur), 0);
      cur.setDate(cur.getDate() + 1);
    }

    productions.forEach(p => {
      const d = this.extractDateStr(p.date);
      map.set(d, (map.get(d) ?? 0) + (p.produced || 0));
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label: this.formatDateLabel(label), value }));
  }

  buildProductionByProduct(productions: Production[], products: Product[]): ProductBreakdown[] {
    const productMap = new Map<string, string>(products.map(p => [p.id, p.name]));
    const map = new Map<string, number>();

    productions.forEach(p => {
      const name = productMap.get(p.productId) ?? `Product ${p.productId.substring(0, 8)}`;
      map.set(name, (map.get(name) ?? 0) + (p.produced || 0));
    });

    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([productName, produced]) => ({ productName, produced }));
  }

  /**
   * Production vs Released Output per Product.
   * Independent transactions — a Product A produced today and a Product B
   * released today simply appear as separate rows. No traceability is implied.
   */
  buildProductPerformance(productions: Production[], releases: OutputRelease[], products: Product[]): ProductPerformanceRow[] {
    const productMap = new Map<string, string>(products.map(p => [p.id, p.name]));
    const rows = new Map<string, ProductPerformanceRow>();

    const keyOf = (productId?: string) => {
      if (productId) {
        return productMap.get(productId) ?? `Product ${productId.substring(0, 8)}`;
      }
      return 'Unattributed Release'; // legacy LEGACY_AMBIGUOUS_SESSION records
    };

    productions.forEach(p => {
      const key = keyOf(p.productId);
      const entry = rows.get(key) ?? { productName: key, presses: 0, produced: 0, releasedOutput: 0 };
      entry.presses       += p.presses || 0;
      entry.produced      += p.produced || 0;
      rows.set(key, entry);
    });

    releases.forEach(r => {
      const key = keyOf(r.productId);
      const entry = rows.get(key) ?? { productName: key, presses: 0, produced: 0, releasedOutput: 0 };
      entry.releasedOutput += r.releasedQuantity || 0;
      rows.set(key, entry);
    });

    return Array.from(rows.values())
      .sort((a, b) => (b.produced || b.releasedOutput) - (a.produced || a.releasedOutput));
  }

  /** Resolves the configured kg/m³ factor for a material transaction item. */
  private conversionFactorOf(item: MaterialTransactionItem, materialsMaster: Material[]): number | undefined {
    const byId = materialsMaster.find(m => m.id === item.materialId);
    if (byId?.conversionKgPerM3) {
      return byId.conversionKgPerM3;
    }
    const byName = materialsMaster.find(m => m.name.toLowerCase() === item.materialName.toLowerCase());
    return byName?.conversionKgPerM3;
  }

  buildMaterialAggregates(materials: MaterialRecord[], materialsMaster: Material[] = []): MaterialAggregate[] {
    const map = new Map<string, MaterialAggregate>();

    materials.forEach(record => {
      (record.materials || []).forEach((item: MaterialTransactionItem) => {
        const key = item.materialName;
        const existing = map.get(key);
        if (existing) {
          existing.theoreticalQuantity += item.theoreticalQuantity || 0;
          existing.actualQuantity      += item.actualQuantity || 0;
          existing.variance            += item.variance || 0;
          existing.totalCost           += item.totalCost || 0;
        } else {
          map.set(key, {
            material:            item.materialName,
            unit:                item.unit,
            theoreticalQuantity: item.theoreticalQuantity || 0,
            actualQuantity:      item.actualQuantity || 0,
            variance:            item.variance || 0,
            totalCost:           item.totalCost || 0,
            cubicMeters:         0,
            conversionStatus:    OK
          });
        }
      });
    });

    const aggregates = Array.from(map.values());
    aggregates.forEach(agg => {
      // Report/display-only kg → m³ conversion. Water (L) needs no conversion.
      if (agg.unit !== 'kg' || agg.actualQuantity <= 0) {
        return;
      }
      const factor = this.conversionFactorByName(agg.material, materialsMaster);
      if (factor != null) {
        const res = MaterialConversionUtil.kgToM3(agg.actualQuantity, factor);
        if (res.status === OK) {
          agg.cubicMeters = res.cubicMeters;
          agg.conversionStatus = OK;
        } else {
          agg.conversionStatus = CONFIGURATION_REQUIRED;
        }
      } else if (agg.material === 'Sand' || agg.material === 'Aggregate') {
        agg.conversionStatus = CONFIGURATION_REQUIRED;
      }
    });

    return aggregates;
  }

  private conversionFactorByName(name: string, materialsMaster: Material[]): number | undefined {
    const byName = materialsMaster.find(m => m.name.toLowerCase() === name.toLowerCase());
    return byName?.conversionKgPerM3;
  }

  buildQualityTrend(qualityTests: QualityTest[], range: DateRange): QualityTrendPoint[] {
    const map = new Map<string, { total: number; count: number }>();

    let cur = new Date(range.startDate);
    const end = new Date(range.endDate);
    while (cur <= end) {
      map.set(this.localDateStr(cur), { total: 0, count: 0 });
      cur.setDate(cur.getDate() + 1);
    }

    qualityTests.forEach(q => {
      const d = this.extractDateStr(q.date);
      const entry = map.get(d) ?? { total: 0, count: 0 };

      // Three-sample events: per-event average Compression from every sample.
      const sampleCompressions = (q.samples || []).map(s => s.compression);
      let eventAvg: number | undefined = sampleCompressions.length > 0
        ? QualityCalculationUtil.averageCompression(sampleCompressions)
        : undefined;

      // Legacy single-measurement events fall back to the stored measurement.
      if (eventAvg == null && q.samples === undefined) {
        const legacy = q.compression ?? q.strength;
        if (typeof legacy === 'number' && Number.isFinite(legacy)) {
          eventAvg = legacy;
        }
      }

      if (eventAvg != null) {
        entry.total += eventAvg;
        entry.count += 1;
      }
      map.set(d, entry);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, { total, count }]) => ({
        label: this.formatDateLabel(label),
        avgCompression: count > 0 ? QualityCalculationUtil.roundToDecimals(total / count) : 0,
        count
      }));
  }

  /**
   * Line status for the filtered period. Rows exist for any line with recorded
   * activity (production, released output, materials, quality, or downtime).
   * Multi-product lines carry a full product breakdown (never one unnamed total).
   */
  buildLineStatus(data: {
    productions: Production[];
    releases: OutputRelease[];
    materials: MaterialRecord[];
    qualityTests: QualityTest[];
    sessions: ProductionSession[];
    lines: Line[];
    products: Product[];
  }): LineStatusRow[] {
    const lineNameMap = new Map<string, string>(data.lines.map(l => [l.id, l.name]));
    const productNameMap = new Map<string, string>(data.products.map(p => [p.id, p.name]));
    const rows = new Map<string, LineStatusRow>();
    const effEntries = new Map<string, { overtimeHours?: number; downtimeMinutes?: number }[]>();

    const rowOf = (lineId: string, fallbackName?: string): LineStatusRow => {
      let row = rows.get(lineId);
      if (!row) {
        row = {
          lineId,
          lineName: lineNameMap.get(lineId) ?? fallbackName ?? `Line ${lineId.substring(0, 8)}`,
          products: [],
          presses: 0,
          produced: 0,
          releasedOutput: 0,
          mixCount: 0,
          downtimeMinutes: 0,
          overtimeHours: 0,
          timeEfficiency: 0,
          qualitySamples: 0,
          qualityPassed: 0,
          qualityFailed: 0,
          hasProduction: false,
          hasRelease: false,
          hasMaterials: false,
          hasQuality: false
        };
        rows.set(lineId, row);
        effEntries.set(lineId, []);
      }
      return row;
    };

    const upsertProduct = (row: LineStatusRow, productName: string, presses: number, produced: number, releasedOutput: number) => {
      const existing = row.products.find(p => p.productName === productName);
      if (existing) {
        existing.presses       += presses;
        existing.produced      += produced;
        existing.releasedOutput += releasedOutput;
      } else {
        row.products.push({ productName, presses, produced, releasedOutput });
      }
    };

    const productNameOf = (productId?: string): string =>
      productId ? (productNameMap.get(productId) ?? `Product ${productId.substring(0, 8)}`) : 'Unattributed Release';

    data.productions.forEach(p => {
      if (!p.lineId) return;
      const row = rowOf(p.lineId);
      row.hasProduction = true;
      upsertProduct(row, productNameOf(p.productId), p.presses || 0, p.produced || 0, 0);
      row.presses  += p.presses || 0;
      row.produced += p.produced || 0;
    });

    data.releases.forEach(r => {
      if (!r.lineId) return;
      const row = rowOf(r.lineId);
      row.hasRelease = true;
      upsertProduct(row, productNameOf(r.productId), 0, 0, r.releasedQuantity || 0);
      row.releasedOutput += r.releasedQuantity || 0;
    });

    data.materials.forEach(m => {
      if (!m.lineId) return;
      const row = rowOf(m.lineId);
      row.hasMaterials = true;
      row.mixCount += m.mixCount || 0;
    });

    data.qualityTests.forEach(q => {
      if (!q.lineId) return;
      const row = rowOf(q.lineId);
      const samples = (q.samples || []).filter(s => s);
      if (samples.length > 0) {
        row.hasQuality = true;
        samples.forEach(s => {
          row.qualitySamples++;
          if (s.compressionResult === 'PASS')      row.qualityPassed++;
          else if (s.compressionResult === 'FAIL') row.qualityFailed++;
        });
      } else {
        row.hasQuality = true;
        row.qualitySamples++;
        if (q.result === 'PASS')      row.qualityPassed++;
        else if (q.result === 'FAIL') row.qualityFailed++;
      }
    });

    data.sessions.forEach(s => {
      s.dailyLineTime?.forEach(d => {
        const row = rowOf(d.lineId, d.lineName);
        row.downtimeMinutes += d.downtimeMinutes || 0;
        row.overtimeHours   += d.overtimeHours || 0;
        effEntries.get(d.lineId)!.push({ overtimeHours: d.overtimeHours, downtimeMinutes: d.downtimeMinutes });
      });
    });

    const result = Array.from(rows.values());
    result.forEach(r => {
      const eff = EfficiencyUtil.calculateAggregateEfficiency(effEntries.get(r.lineId) ?? []);
      r.timeEfficiency = eff.timeEfficiency;
      r.products.sort((a, b) => (b.produced + b.releasedOutput) - (a.produced + a.releasedOutput));
    });

    return result.sort((a, b) => a.lineName.localeCompare(b.lineName));
  }

  /** Safe, derived operational alerts. No invented thresholds. */
  buildAlerts(data: {
    productions: Production[];
    materials: MaterialRecord[];
    materialsMaster: Material[];
    products: Product[];
    qualityTests: QualityTest[];
  }): OperationalAlert[] {
    const alerts: OperationalAlert[] = [];

    // 1) Production exists but no Materials recorded for the same Line.
    const materialLines = new Set(data.materials.map(m => m.lineId).filter(Boolean));
    const linesWithProduction = new Map<string, { produced: number }>();
    data.productions.forEach(p => {
      if (!p.lineId) return;
      const cur = linesWithProduction.get(p.lineId) ?? { produced: 0 };
      cur.produced += p.produced || 0;
      linesWithProduction.set(p.lineId, cur);
    });
    linesWithProduction.forEach((info, lineId) => {
      if (!materialLines.has(lineId)) {
        alerts.push({
          severity: 'warning',
          icon: 'science',
          title: 'Production recorded, Materials missing',
          description: `Line recorded ${info.produced} pieces produced today but no Materials record was found for that Line.`
        });
      }
    });

    // 2) Missing Sand/Aggregate conversion setting.
    const configMissing = new Set<string>();
    data.materials.forEach(m => {
      (m.materials || []).forEach((item: MaterialTransactionItem) => {
        if (item.unit !== 'kg' || (item.materialName !== 'Sand' && item.materialName !== 'Aggregate')) return;
        const factor = this.conversionFactorOf(item, data.materialsMaster);
        if (factor == null) {
          configMissing.add(item.materialName);
        }
      });
    });
    configMissing.forEach(name => {
      alerts.push({
        severity: 'warning',
        icon: 'settings_input_antenna',
        title: `${name} conversion not configured`,
        description: `Set ${name}KgPerM3 in the Material master to display and report ${name} in cubic metres.`
      });
    });

    // 3) Product master missing Area / Compression Standard / Standard Height / Standard Weight.
    const usedProductIds = new Set<string>();
    data.productions.forEach(p => p.productId && usedProductIds.add(p.productId));
    data.qualityTests.forEach(q => q.productId && usedProductIds.add(q.productId));
    data.products.forEach(p => {
      if (!usedProductIds.has(p.id)) return;
      const missing: string[] = [];
      if (!(typeof p.productArea === 'number' && Number.isFinite(p.productArea) && p.productArea > 0)) missing.push('Area');
      if (!(typeof p.standardStrength === 'number' && Number.isFinite(p.standardStrength) && p.standardStrength > 0)) missing.push('Compression Standard');
      if (!(typeof p.standardHeight === 'number' && Number.isFinite(p.standardHeight) && p.standardHeight > 0)) missing.push('Standard Height');
      if (!(typeof p.standardWeight === 'number' && Number.isFinite(p.standardWeight) && p.standardWeight > 0)) missing.push('Standard Weight');
      if (missing.length > 0) {
        alerts.push({
          severity: 'warning',
          icon: 'warning_amber',
          title: `Product configuration incomplete: ${p.name}`,
          description: `Missing: ${missing.join(', ')}.`
        });
      }
    });

    // 4) Incomplete Quality configuration (samples that could not be evaluated).
    let incompleteQuality = 0;
    data.qualityTests.forEach(q => {
      (q.samples || []).forEach(s => {
        if (s.compressionResult === CONFIGURATION_REQUIRED) incompleteQuality++;
      });
    });
    if (incompleteQuality > 0) {
      alerts.push({
        severity: 'warning',
        icon: 'verified',
        title: 'Quality configuration incomplete',
        description: `${incompleteQuality} sample(s) could not be evaluated — check Product Area and Compression Standard.`
      });
    }

    return alerts;
  }

  // ─── Recent Activities ────────────────────────────────────────────────────

  buildRecentActivities(
    productions: Production[],
    materials: MaterialRecord[],
    qualityTests: QualityTest[],
    products: Product[]
  ): RecentActivity[] {
    const productMap = new Map<string, string>(products.map(p => [p.id, p.name]));
    const activities: RecentActivity[] = [];

    productions.forEach(p => {
      activities.push({
        type: 'production',
        icon: 'precision_manufacturing',
        title: 'Production',
        description: `${(p.produced || 0).toLocaleString()} pieces — ${productMap.get(p.productId) ?? 'Unknown Product'}`,
        timestamp: new Date(p.createdAt),
        relativeTime: this.getRelativeTime(new Date(p.createdAt))
      });
    });

    materials.forEach(m => {
      activities.push({
        type: 'materials',
        icon: 'science',
        title: 'Materials',
        description: `${m.mixCount} mixes — ${m.productId ? (productMap.get(m.productId) ?? 'Unknown Product') : 'No product'}`,
        timestamp: new Date(m.createdAt),
        relativeTime: this.getRelativeTime(new Date(m.createdAt))
      });
    });

    qualityTests.forEach(q => {
      const samples = (q.samples || []).filter((s): s is QualitySample => !!s);
      if (samples.length > 0) {
        const passed = samples.filter(s => s.compressionResult === 'PASS').length;
        const failed = samples.filter(s => s.compressionResult === 'FAIL').length;
        activities.push({
          type: 'quality',
          icon: failed > 0 ? 'cancel' : 'verified',
          title: 'Quality',
          description: `${samples.length} samples tested, ${passed} passed, ${failed} failed — ${q.productName}`,
          timestamp: new Date(q.createdAt),
          relativeTime: this.getRelativeTime(new Date(q.createdAt))
        });
      } else {
        const measured = q.compression != null ? `${q.compression} compression` : (q.strength != null ? `${q.strength} MPa` : 'No measurement');
        activities.push({
          type: 'quality',
          icon: q.result === 'PASS' ? 'verified' : 'cancel',
          title: 'Quality',
          description: `Sample ${q.sample || '—'} ${q.result === 'PASS' ? 'passed' : 'failed'} — ${measured} (${q.productName})`,
          timestamp: new Date(q.createdAt),
          relativeTime: this.getRelativeTime(new Date(q.createdAt))
        });
      }
    });

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 15);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private formatDateLabel(dateStr: string): string {
    const [, m, d] = dateStr.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${monthNames[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs   = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);

    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)  return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
