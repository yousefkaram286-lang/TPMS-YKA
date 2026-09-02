import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Production } from '../models/production.model';
import { ProductionSession } from '../models/production-session.model';
import { MaterialRecord } from '../models/material-record.model';
import { QualityTest } from '../models/quality-test.model';
import { QualitySample } from '../models/quality-test.model';
import { Product } from '../models/product.model';
import { Shift } from '../models/shift.model';
import { Line } from '../models/line.model';
import { Material } from '../models/material.model';
import { OutputRelease } from '../models/output-release.model';
import { UnitCost } from '../models/unit-cost.model';
import { DateRange } from './dashboard.service';
import { EfficiencyUtil } from '../utils/efficiency.util';
import { MaterialConversionUtil, OK, CONFIGURATION_REQUIRED } from '../utils/material-conversion.util';
import { QualityCalculationUtil } from '../utils/quality-calculation.util';

export type ReportType = 'production' | 'materials' | 'quality' | 'complete' | 'daily' | 'monthly';
export type ReportFormat = 'xlsx' | 'pdf';

export interface ReportParams {
  type: ReportType;
  format: ReportFormat;
  range: DateRange;
  productions: Production[];
  sessions: ProductionSession[];
  materials: MaterialRecord[];
  qualityTests: QualityTest[];
  /** Output Release transactions — INDEPENDENT of Production; used by daily/monthly reports. */
  releases: OutputRelease[];
  products: Product[];
  shifts: Shift[];
  lines: Line[];
  /** Material master — the ONLY source for kg → m³ report conversions. */
  materialsMaster: Material[];
  /**
   * Unit cost master — demo-priced (business-unverified) items are kept out of
   * operational reports: their price cells render as '—' and their cost is
   * excluded from every total. Config data is never modified.
   */
  unitCostsMaster?: UnitCost[];
}

/** One product aggregated within a line-level view of the daily/monthly report. */
export interface ReportLineProductRow {
  productName: string;
  presses: number;
  produced: number;
  releasedOutput: number;
}

/** One production line row of the daily/monthly operational report. */
export interface ReportLineOpsRow {
  lineId: string;
  lineName: string;
  products: ReportLineProductRow[];
  productLabel: string;
  /** Products with produced > 0 (pressed) — kept separate from released. */
  pressedProductsLabel: string;
  /** Products with releasedOutput > 0 — kept separate from pressed. */
  releasedProductsLabel: string;
  shiftsLabel: string;
  presses: number;
  produced: number;
  releasedOutput: number;
  mixCount: number;
  cementKg: number;
  sandKg: number;
  sandM3: number | typeof CONFIGURATION_REQUIRED;
  aggregateKg: number;
  aggregateM3: number | typeof CONFIGURATION_REQUIRED;
  waterL: number;
  downtimeMinutes: number;
  overtimeHours: number;
  availableMinutes: number;
  actualRunMinutes: number;
  timeEfficiency: number;
  samples: number;
  passed: number;
  failed: number;
}

/** Product-level Production vs Released Output (independent transactions). */
export interface ReportProductBreakdownRow {
  productName: string;
  presses: number;
  produced: number;
  releasedOutput: number;
}

/** Rows of the Production + Output comparison table (per day / line / product). */
export interface ReportProductionOutputRow {
  date: string;
  lineName: string;
  productName: string;
  presses: number;
  produced: number;
  releasedOutput: number;
}

/** Materials usage per MaterialRecord (per line / day) with kg retained for audit. */
export interface ReportMaterialUsageRow {
  date: string;
  lineId: string;
  lineName: string;
  mixCount: number;
  cementKg: number;
  sandKg: number;
  sandM3: number | typeof CONFIGURATION_REQUIRED;
  aggregateKg: number;
  aggregateM3: number | typeof CONFIGURATION_REQUIRED;
  waterL: number;
}

/** Materials usage aggregated per line across the report period. */
export interface ReportLineMaterialRow {
  lineId: string;
  lineName: string;
  mixCount: number;
  cementKg: number;
  sandKg: number;
  sandM3: number | typeof CONFIGURATION_REQUIRED;
  aggregateKg: number;
  aggregateM3: number | typeof CONFIGURATION_REQUIRED;
  waterL: number;
}

/** Factory-wide aggregates for the daily/monthly report header KPIs. */
export interface ReportOperationKpis {
  presses: number;
  produced: number;
  released: number;
  mixes: number;
  cementKg: number;
  sandKg: number;
  sandM3: number | typeof CONFIGURATION_REQUIRED;
  aggregateKg: number;
  aggregateM3: number | typeof CONFIGURATION_REQUIRED;
  waterL: number;
  downtime: number;
  timeEfficiency: number;
  qualityRecorded: number;
  qualityAssessed: number;
  qualityPassed: number;
  qualityFailed: number;
  qualityRate: string;
}

/**
 * One Line + Product row of the Complete report Management Quality Summary.
 * Averages use only ACTUAL measurements; compression averages follow
 * QualityCalculationUtil.averageCompression (all samples must be valid, else
 * the value is undefined and renders as '—'). PASS/FAIL stay compression-only.
 */
export interface ReportQualityManagementRow {
  lineName: string;
  productName: string;
  recorded: number;
  assessed: number;
  passed: number;
  failed: number;
  passRate: string;
  avgHeight: number | undefined;
  avgWeight: number | undefined;
  avgLoad: number | undefined;
  avgCompression: number | undefined;
}

@Injectable({ providedIn: 'root' })
export class ReportService {

  private readonly BRAND_DARK: [number, number, number] = [43, 33, 24];
  private readonly BRAND_GOLD: [number, number, number] = [176, 141, 87];
  private readonly TEXT_DARK: [number, number, number] = [30, 30, 30];
  private readonly TEXT_MED: [number, number, number] = [100, 100, 100];
  private readonly TEXT_LIGHT: [number, number, number] = [150, 150, 150];
  private readonly WHITE: [number, number, number] = [255, 255, 255];
  private readonly TABLE_HEADER_BG: [number, number, number] = [43, 33, 24];
  private readonly TABLE_ALT_ROW: [number, number, number] = [250, 248, 245];
  private readonly TABLE_BORDER: [number, number, number] = [220, 220, 220];
  private readonly SUCCESS: [number, number, number] = [34, 139, 34];
  private readonly ERROR: [number, number, number] = [185, 74, 72];
  private readonly LIGHT_BG: [number, number, number] = [248, 246, 243];

  // ─── Public Entry Point ──────────────────────────────────────────────────

  generate(params: ReportParams): void {
    if (params.format === 'xlsx') {
      this.generateExcel(params);
    } else {
      this.generatePdf(params);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCEL GENERATION — Premium Professional Business Report
  // ═══════════════════════════════════════════════════════════════════════════

  private readonly EX_BRAND = '2B2118';
  private readonly EX_GOLD = 'B08D57';
  private readonly EX_DARK = '1E1E1E';
  private readonly EX_MED = '646464';
  private readonly EX_LIGHT = '969696';
  private readonly EX_WHITE = 'FFFFFF';
  private readonly EX_ALT = 'FAF8F5';
  private readonly EX_BORDER = 'DCDCDC';
  private readonly EX_SUCCESS = '1B7A3D';
  private readonly EX_ERROR = 'B94A48';
  private readonly EX_LIGHT_BG = 'F8F6F3';
  private readonly EX_KPI_BG = 'F0EDE8';
  private readonly EX_HEADER_BORDER = 'B08D57';

  private generateExcel(p: ReportParams): void {
    const wb = this.buildExcelWorkbook(p);
    const filename = this.buildFilename(p, 'xlsx');
    XLSX.writeFile(wb, filename, { cellStyles: true } as any);
  }

  private buildExcelWorkbook(p: ReportParams): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    wb.Props = {
      Title: `TPMS ${p.type.charAt(0).toUpperCase() + p.type.slice(1)} Report`,
      Author: 'TPMS - Production Management System',
      CreatedDate: new Date()
    };

    if (p.type === 'complete') {
      this.exAddExecutiveSummary(wb, p);
      this.exAddProductionSheet(wb, p);
      this.exAddMaterialsSheet(wb, p);
      this.exAddQualityManagementSheet(wb, p);
    } else if (p.type === 'production') {
      this.exAddProductionSheet(wb, p);
    } else if (p.type === 'materials') {
      this.exAddMaterialsSheet(wb, p);
    } else if (p.type === 'quality') {
      this.exAddQualitySheet(wb, p);
    } else if (p.type === 'daily') {
      this.exAddDailySheet(wb, p);
      this.exAddQualitySheet(wb, p, 'Daily Quality Detail');
    } else if (p.type === 'monthly') {
      this.exAddMonthlySheet(wb, p);
    }

    return wb;
  }

  // ─── Excel Style Helpers ──────────────────────────────────────────────────

  private exStyle(ws: XLSX.WorkSheet, ref: string, style: Record<string, any>): void {
    const cell = ws[ref];
    if (cell) { cell.s = { ...(cell.s || {}), ...style }; }
  }

  private exRangeStyle(ws: XLSX.WorkSheet, range: string, style: Record<string, any>): void {
    const dec = XLSX.utils.decode_range(range);
    for (let r = dec.s.r; r <= dec.e.r; r++) {
      for (let c = dec.s.c; c <= dec.e.c; c++) {
        this.exStyle(ws, XLSX.utils.encode_cell({ r, c }), style);
      }
    }
  }

  private exHeaderStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 20, color: { rgb: this.EX_BRAND }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: this.EX_LIGHT_BG } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  private exSubtitleStyle(): Record<string, any> {
    return {
      font: { sz: 10, italic: true, color: { rgb: this.EX_MED }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: this.EX_LIGHT_BG } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  private exReportTitleStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 14, color: { rgb: this.EX_BRAND }, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  private exMetaLabelStyle(): Record<string, any> {
    return {
      font: { sz: 9, color: { rgb: this.EX_MED }, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  private exMetaValueStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 9, color: { rgb: this.EX_DARK }, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  private exSectionTitleStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 11, color: { rgb: this.EX_BRAND }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: this.EX_LIGHT_BG } },
      border: { bottom: { style: 'medium', color: { rgb: this.EX_GOLD } } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }

  private exKpiLabelStyle(): Record<string, any> {
    return {
      font: { sz: 8, color: { rgb: this.EX_MED }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: this.EX_KPI_BG } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: this.EX_BORDER } },
        bottom: { style: 'thin', color: { rgb: this.EX_BORDER } },
        left: { style: 'thin', color: { rgb: this.EX_BORDER } },
        right: { style: 'thin', color: { rgb: this.EX_BORDER } }
      }
    };
  }

  private exKpiValueStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 14, color: { rgb: this.EX_DARK }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: this.EX_KPI_BG } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: this.EX_BORDER } },
        bottom: { style: 'medium', color: { rgb: this.EX_GOLD } },
        left: { style: 'thin', color: { rgb: this.EX_BORDER } },
        right: { style: 'thin', color: { rgb: this.EX_BORDER } }
      }
    };
  }

  private exTableHeaderStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 9, color: { rgb: this.EX_WHITE }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: this.EX_BRAND } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: this.EX_BRAND } },
        bottom: { style: 'medium', color: { rgb: this.EX_GOLD } },
        left: { style: 'thin', color: { rgb: '3D3228' } },
        right: { style: 'thin', color: { rgb: '3D3228' } }
      }
    };
  }

  private exTableDataStyle(alt: boolean): Record<string, any> {
    return {
      font: { sz: 9, color: { rgb: this.EX_DARK }, name: 'Calibri' },
      fill: alt ? { patternType: 'solid', fgColor: { rgb: this.EX_ALT } } : undefined,
      border: {
        bottom: { style: 'hair', color: { rgb: this.EX_BORDER } }
      },
      alignment: { vertical: 'center' }
    };
  }

  private exTableNumericStyle(alt: boolean): Record<string, any> {
    return {
      ...this.exTableDataStyle(alt),
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0'
    };
  }

  private exTableDecimalStyle(alt: boolean): Record<string, any> {
    return {
      ...this.exTableDataStyle(alt),
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0.0'
    };
  }

  private exTableCurrencyStyle(alt: boolean): Record<string, any> {
    return {
      ...this.exTableDataStyle(alt),
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0.00'
    };
  }

  private exTotalsStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 9, color: { rgb: this.EX_BRAND }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: this.EX_KPI_BG } },
      border: {
        top: { style: 'medium', color: { rgb: this.EX_GOLD } },
        bottom: { style: 'double', color: { rgb: this.EX_GOLD } }
      }
    };
  }

  private exPassStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 9, color: { rgb: this.EX_SUCCESS }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: 'E8F5E9' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'hair', color: { rgb: this.EX_BORDER } } }
    };
  }

  private exFailStyle(): Record<string, any> {
    return {
      font: { bold: true, sz: 9, color: { rgb: this.EX_ERROR }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFEBEE' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'hair', color: { rgb: this.EX_BORDER } } }
    };
  }

  private exConfigRequiredStyle(): Record<string, any> {
    return {
      font: { italic: true, sz: 9, color: { rgb: this.EX_MED }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFF7E6' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'hair', color: { rgb: this.EX_BORDER } } }
    };
  }

  private exAverageStyle(): Record<string, any> {
    return {
      font: { bold: true, italic: true, sz: 9, color: { rgb: this.EX_BRAND }, name: 'Calibri' },
      fill: { patternType: 'solid', fgColor: { rgb: 'F5EFE2' } },
      alignment: { vertical: 'center' },
      border: { bottom: { style: 'hair', color: { rgb: this.EX_BORDER } } }
    };
  }

  // ─── Sheet Layout Helpers ─────────────────────────────────────────────────

  private exWriteReportHeader(ws: XLSX.WorkSheet, title: string, p: ReportParams, colCount: number): number {
    const lastCol = XLSX.utils.encode_col(colCount - 1);
    const merges: XLSX.Range[] = [];

    ws['A1'] = { v: 'TPMS', t: 's' };
    this.exStyle(ws, 'A1', this.exHeaderStyle());
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });

    ws['A2'] = { v: 'Production Management System', t: 's' };
    this.exStyle(ws, 'A2', this.exSubtitleStyle());
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

    ws['A4'] = { v: title.toUpperCase(), t: 's' };
    this.exStyle(ws, 'A4', this.exReportTitleStyle());
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } });

    const period = `Report Period:  ${this.fmtDate(p.range.startDate)}  –  ${this.fmtDate(p.range.endDate)}`;
    ws['A5'] = { v: period, t: 's' };
    this.exStyle(ws, 'A5', this.exMetaLabelStyle());
    merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } });

    const gen = `Generated:  ${this.fmtDate(new Date().toISOString().substring(0, 10))}    |    Report Type:  ${title}`;
    ws['A6'] = { v: gen, t: 's' };
    this.exStyle(ws, 'A6', this.exMetaLabelStyle());
    merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: colCount - 1 } });

    ws['!merges'] = (ws['!merges'] || []).concat(merges);

    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][0] = { hpt: 36 };
    ws['!rows'][1] = { hpt: 18 };
    ws['!rows'][3] = { hpt: 26 };
    ws['!rows'][4] = { hpt: 16 };
    ws['!rows'][5] = { hpt: 16 };

    return 7;
  }

  private exWriteKpiRow(ws: XLSX.WorkSheet, labels: string[], values: (string | number)[], startRow: number): number {
    const merges: XLSX.Range[] = [];
    labels.forEach((label, i) => {
      const col = XLSX.utils.encode_col(i);
      const labelRef = `${col}${startRow + 1}`;
      const valueRef = `${col}${startRow + 2}`;

      ws[labelRef] = { v: label, t: 's' };
      this.exStyle(ws, labelRef, this.exKpiLabelStyle());

      const val = values[i];
      ws[valueRef] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
      this.exStyle(ws, valueRef, this.exKpiValueStyle());
      if (typeof val === 'number') {
        (ws[valueRef] as any).z = '#,##0';
      }
    });

    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][startRow] = { hpt: 16 };
    ws['!rows'][startRow + 1] = { hpt: 28 };

    return startRow + 3;
  }

  private exWriteTableHeader(ws: XLSX.WorkSheet, headers: string[], row: number): void {
    headers.forEach((h, i) => {
      const ref = XLSX.utils.encode_cell({ r: row, c: i });
      ws[ref] = { v: h, t: 's' };
      this.exStyle(ws, ref, this.exTableHeaderStyle());
    });
    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][row] = { hpt: 22 };
  }

  private exWriteTableRow(ws: XLSX.WorkSheet, values: (string | number)[], row: number, numericCols?: Set<number>, decimalCols?: Set<number>, currencyCols?: Set<number>): void {
    const alt = row % 2 === 0;
    values.forEach((val, i) => {
      const ref = XLSX.utils.encode_cell({ r: row, c: i });
      const isNum = typeof val === 'number';
      ws[ref] = { v: val, t: isNum ? 'n' : 's' };

      if (currencyCols?.has(i)) {
        this.exStyle(ws, ref, this.exTableCurrencyStyle(alt));
      } else if (decimalCols?.has(i)) {
        this.exStyle(ws, ref, this.exTableDecimalStyle(alt));
      } else if (numericCols?.has(i) || isNum) {
        this.exStyle(ws, ref, this.exTableNumericStyle(alt));
      } else {
        this.exStyle(ws, ref, this.exTableDataStyle(alt));
      }
    });
    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][row] = { hpt: 18 };
  }

  private exWriteTotalsRow(ws: XLSX.WorkSheet, values: (string | number)[], row: number, numericCols?: Set<number>): void {
    values.forEach((val, i) => {
      const ref = XLSX.utils.encode_cell({ r: row, c: i });
      const isNum = typeof val === 'number';
      ws[ref] = { v: val, t: isNum ? 'n' : 's' };

      const style: any = this.exTotalsStyle();
      if (numericCols?.has(i) || isNum) {
        style['alignment'] = { horizontal: 'right', vertical: 'center' };
        style['numFmt'] = '#,##0';
      }
      this.exStyle(ws, ref, style);
    });
    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][row] = { hpt: 22 };
  }

  private exWriteNoData(ws: XLSX.WorkSheet, row: number, colCount: number): number {
    const ref = `A${row}`;
    ws[ref] = { v: 'No data available for this report type in the selected date range.', t: 's' };
    this.exStyle(ws, ref, {
      font: { italic: true, sz: 10, color: { rgb: this.EX_LIGHT }, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: colCount - 1 } }]);
    return row + 1;
  }

  private exWriteSectionTitle(ws: XLSX.WorkSheet, title: string, row: number, colCount: number): number {
    const ref = `A${row}`;
    ws[ref] = { v: title, t: 's' };
    this.exStyle(ws, ref, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: colCount - 1 } }]);
    return row + 1;
  }

  private exFinalizeSheet(ws: XLSX.WorkSheet, colWidths: number[], freezeRow: number, filterRange?: XLSX.Range): void {
    // Compute !ref from all populated cells so Excel actually sees the data
    let maxR = 0;
    let maxC = 0;
    Object.keys(ws).forEach(key => {
      if (key.startsWith('!')) return;
      const addr = XLSX.utils.decode_cell(key);
      if (addr.r > maxR) maxR = addr.r;
      if (addr.c > maxC) maxC = addr.c;
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });

    ws['!cols'] = colWidths.map(w => ({ wch: w }));
    if (freezeRow > 0) {
      ws['!freeze'] = { xSplit: 0, ySplit: freezeRow, topLeftCell: XLSX.utils.encode_cell({ r: freezeRow, c: 0 }), state: 'frozen' } as any;
    }
    if (filterRange) {
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(filterRange) };
    }
    ws['!pageSetup'] = { paper: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 } as any;
    ws['!pageMargins'] = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } as any;
  }

  // ─── Executive Summary Sheet ──────────────────────────────────────────────

  private exAddExecutiveSummary(wb: XLSX.WorkBook, p: ReportParams): void {
    const stats = this.computeStats(p);
    const ws = XLSX.utils.aoa_to_sheet([]);
    const COLS = 10;

    let row = this.exWriteReportHeader(ws, 'Executive Summary', p, COLS);
    row++;

    // ── Production KPIs ──
    const secRef = `A${row}`;
    ws[secRef] = { v: 'KEY PERFORMANCE INDICATORS', t: 's' };
    this.exStyle(ws, secRef, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } }]);
    row++;

    row = this.exWriteKpiRow(ws,
      ['Total Production', 'Total Presses', 'Total Products', 'Total Lines', 'Total Released Output', 'Total Overtime', 'Total Downtime', 'Time Efficiency'],
      [stats.totalProduced, stats.totalPresses, this.countUnique(p.productions, 'productId'), this.countUnique(p.productions, 'lineId'), stats.totalReleased, `${stats.totalOvertime}h`, `${stats.totalDowntime}m`, `${stats.timeEfficiency}%`],
      row
    );
    row = this.exWriteKpiRow(ws,
      ['Total Mixes', 'Material Records', 'Total Cost', 'Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Sample Pass Rate'],
      [stats.totalMixes, p.materials.length, stats.totalCost, stats.recorded, stats.assessed, stats.passed, stats.failed, `${stats.passRate}%`],
      row
    );
    row++;

    // ── Production by Product (with bar chart) ──
    const productMap = this.buildMap(p.products);
    const productProduction = new Map<string, number>();
    p.productions.forEach(prod => {
      const name = productMap.get(prod.productId) ?? 'Unknown';
      productProduction.set(name, (productProduction.get(name) ?? 0) + (prod.produced || 0));
    });
    const prodEntries = Array.from(productProduction.entries()).sort(([, a], [, b]) => b - a);

    const sec2Ref = `A${row}`;
    ws[sec2Ref] = { v: 'PRODUCTION BY PRODUCT', t: 's' };
    this.exStyle(ws, sec2Ref, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } }]);
    row++;

    this.exWriteTableHeader(ws, ['Product', 'Produced', 'Bar', '% of Total'], row - 1);
    row++;
    const maxProd = prodEntries.length > 0 ? Math.max(...prodEntries.map(([, v]) => v)) : 1;
    prodEntries.forEach(([name, produced]) => {
      const pct = stats.totalProduced > 0 ? (produced / stats.totalProduced * 100) : 0;
      const barLen = maxProd > 0 ? Math.round((produced / maxProd) * 20) : 0;
      const bar = '\u2588'.repeat(barLen);
      this.exWriteTableRow(ws, [name, produced, bar, `${pct.toFixed(1)}%`], row - 1);
      row++;
    });
    row++;

    // ── Quality Summary ──
    const sec3Ref = `A${row}`;
    ws[sec3Ref] = { v: 'QUALITY SUMMARY', t: 's' };
    this.exStyle(ws, sec3Ref, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } }]);
    row++;

    this.exWriteTableHeader(ws, ['Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Sample Pass Rate'], row - 1);
    row++;
    this.exWriteTableRow(ws, [stats.recorded, stats.assessed, stats.passed, stats.failed, `${stats.passRate}%`], row - 1, new Set([0, 1, 2, 3]));
    row++;

    // ── Production by Day ──
    const sec4Ref = `A${row}`;
    ws[sec4Ref] = { v: 'PRODUCTION BY DAY', t: 's' };
    this.exStyle(ws, sec4Ref, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } }]);
    row++;

    const dayMap = new Map<string, number>();
    p.productions.forEach(prod => {
      dayMap.set(prod.date, (dayMap.get(prod.date) ?? 0) + (prod.produced || 0));
    });
    const dayEntries = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    this.exWriteTableHeader(ws, ['Date', 'Produced'], row - 1);
    row++;
    dayEntries.forEach(([date, produced]) => {
      this.exWriteTableRow(ws, [date, produced], row - 1, new Set([1]));
      row++;
    });
    row++;

    // ── Materials Summary ──
    const sec5Ref = `A${row}`;
    ws[sec5Ref] = { v: 'MATERIALS OVERVIEW', t: 's' };
    this.exStyle(ws, sec5Ref, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } }]);
    row++;

    const matAgg = this.buildMaterialAggregates(p);
    this.exWriteTableHeader(ws, ['Material', 'Unit', 'Theoretical', 'Actual', 'Variance', 'Total Cost'], row - 1);
    row++;
    matAgg.forEach(m => {
      this.exWriteTableRow(ws, [m.material, m.unit, m.standardOk ? m.theoreticalQuantity : 'Not Configured', m.actualQuantity, m.standardOk ? m.variance : '—', m.totalCost], row - 1, new Set([2, 3, 4]), undefined, new Set([5]));
      row++;
    });

    this.exFinalizeSheet(ws, [22, 14, 14, 12, 12, 14, 14, 14, 14, 14], 7);

    XLSX.utils.book_append_sheet(wb, ws, 'Executive Summary');

    const summaryIdx = wb.SheetNames.indexOf('Executive Summary');
    if (summaryIdx > 0) {
      wb.SheetNames.splice(summaryIdx, 1);
      wb.SheetNames.unshift('Executive Summary');
      const sheet = wb.Sheets['Executive Summary'];
      delete wb.Sheets['Executive Summary'];
      wb.Sheets['Executive Summary'] = sheet;
    }
  }

  private buildMaterialAggregates(p: ReportParams): { material: string; unit: string; theoreticalQuantity: number; actualQuantity: number; variance: number; totalCost: number; standardOk: boolean }[] {
    const map = new Map<string, { material: string; unit: string; theoreticalQuantity: number; actualQuantity: number; variance: number; totalCost: number; standardOk: boolean }>();
    p.materials.forEach(rec => {
      (rec.materials || []).forEach(item => {
        const eff = this.effectiveItemCost(p, item);
        const itemStandardOk = this.materialStandardConfigured(item.perMixStandard);
        const existing = map.get(item.materialName);
        if (existing) {
          existing.theoreticalQuantity += item.theoreticalQuantity || 0;
          existing.actualQuantity += item.actualQuantity || 0;
          existing.variance += item.variance || 0;
          existing.totalCost += eff.totalCost ?? 0;
          existing.standardOk = existing.standardOk && itemStandardOk;
        } else {
          map.set(item.materialName, {
            material: item.materialName, unit: item.unit,
            theoreticalQuantity: item.theoreticalQuantity || 0, actualQuantity: item.actualQuantity || 0,
            variance: item.variance || 0, totalCost: eff.totalCost ?? 0,
            standardOk: itemStandardOk
          });
        }
      });
    });
    return Array.from(map.values());
  }

  // ─── Production Sheet ──────────────────────────────────────────────────────

  private exAddProductionSheet(wb: XLSX.WorkBook, p: ReportParams): void {
    const productMap = this.buildMap(p.products);
    const shiftMap = this.buildMap(p.shifts);
    const lineMap = this.buildMap(p.lines);
    const sessionMap = this.buildSessionMap(p.sessions);
    const COLS = 12;

    const ws = XLSX.utils.aoa_to_sheet([]);
    let row = this.exWriteReportHeader(ws, 'Production Report', p, COLS);
    row++;

    // KPIs — press-side only; time from the authoritative 390-min/day/line rule.
    let totalPresses = 0, totalProduced = 0;
    p.productions.forEach(prod => {
      totalPresses += prod.presses || 0;
      totalProduced += prod.produced || 0;
    });
    const time = this.timeAggregate(p);

    row = this.exWriteKpiRow(ws,
      ['Total Production', 'Total Presses', 'Total Products', 'Total Lines', 'Total Overtime (hrs)', 'Total Downtime (min)'],
      [totalProduced, totalPresses, this.countUnique(p.productions, 'productId'), this.countUnique(p.productions, 'lineId'), time.totalOvertimeHours, time.totalDowntimeMinutes],
      row
    );
    row++;

    // Section title
    const secRef = `A${row}`;
    ws[secRef] = { v: 'PRODUCTION DETAILS', t: 's' };
    this.exStyle(ws, secRef, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } }]);
    row++;

    const headers = ['Date', 'Line', 'Product', 'Shift', 'Supervisor', 'Pieces/Press', 'Presses', 'Produced', 'Overtime (hrs)', 'Downtime (min)', 'Downtime Reason', 'Notes'];
    this.exWriteTableHeader(ws, headers, row - 1);
    const tableStartRow = row;
    row++;

    const numCols = new Set([5, 6, 7, 8, 9]);
    p.productions.forEach(prod => {
      const session = this.findSession(prod, sessionMap);
      const lineEntry = session?.dailyLineTime?.find(d => d.lineId === prod.lineId);
      this.exWriteTableRow(ws, [
        prod.date,
        lineMap.get(prod.lineId) ?? prod.lineId,
        productMap.get(prod.productId) ?? prod.productId,
        shiftMap.get(prod.shiftId) ?? prod.shiftId,
        prod.supervisor ?? '',
        prod.piecesPerPress ?? 0,
        prod.presses ?? 0,
        prod.produced ?? 0,
        lineEntry?.overtimeHours ?? 0,
        lineEntry?.downtimeMinutes ?? 0,
        lineEntry?.downtimeReason ?? '',
        session?.notes ?? ''
      ], row - 1, numCols);
      row++;
    });

    // Totals row
    if (p.productions.length > 0) {
      this.exWriteTotalsRow(ws, [
        'TOTAL', '', '', '', '', '',
        totalPresses, totalProduced, time.totalOvertimeHours, time.totalDowntimeMinutes, '', ''
      ], row - 1, numCols);
      row++;
    } else {
      row = this.exWriteNoData(ws, row, COLS);
    }

    this.exFinalizeSheet(ws, [12, 14, 18, 12, 14, 12, 10, 10, 14, 14, 20, 25], 7, {
      s: { r: tableStartRow - 1, c: 0 },
      e: { r: row - 2, c: COLS - 1 }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Production');
  }

  // ─── Materials Sheet ───────────────────────────────────────────────────────

  private exAddMaterialsSheet(wb: XLSX.WorkBook, p: ReportParams): void {
    const productMap = this.buildMap(p.products);
    const lineMap = this.buildMap(p.lines);
    const COLS = 11;

    const ws = XLSX.utils.aoa_to_sheet([]);
    let row = this.exWriteReportHeader(ws, 'Materials Report', p, COLS);
    row++;

    let grandTotalCost = 0;
    let totalMixes = 0;
    p.materials.forEach(m => {
      grandTotalCost += this.effectiveRecordCost(p, m);
      totalMixes += m.mixCount || 0;
    });

    row = this.exWriteKpiRow(ws,
      ['Total Records', 'Total Mixes', 'Grand Total Cost', 'Material Types', '', ''],
      [p.materials.length, totalMixes, grandTotalCost, new Set(p.materials.flatMap(m => (m.materials || []).map(mi => mi.materialName))).size, '', ''],
      row
    );
    row++;

    // ── Materials by Line (primary view) ──
    row = this.exWriteSectionTitle(ws, 'MATERIALS BY LINE', row, COLS);
    this.exWriteTableHeader(ws, ['Line', 'Mix Count', 'Cement (kg)', 'Sand (kg)', 'Sand (m³)', 'Aggregate (kg)', 'Aggregate (m³)', 'Water (L)'], row - 1);
    row++;
    const lineSummary = this.buildLineMaterialRows(p);
    lineSummary.forEach(l => {
      this.exWriteTableRow(ws, [
        l.lineName, l.mixCount, l.cementKg, l.sandKg, l.sandM3, l.aggregateKg, l.aggregateM3, l.waterL
      ], row - 1, new Set([1, 2, 3, 5, 7]));
      row++;
    });
    if (lineSummary.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }
    row++;

    const secRef = `A${row}`;
    ws[secRef] = { v: 'MATERIALS DETAILS', t: 's' };
    this.exStyle(ws, secRef, this.exSectionTitleStyle());
    ws['!merges'] = (ws['!merges'] || []).concat([{ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: COLS - 1 } }]);
    row++;

    const headers = ['Date', 'Line', 'Product', 'Mix Count', 'Material', 'Unit', 'Theoretical Qty', 'Actual Qty', 'Variance', 'Unit Cost', 'Total Cost'];
    this.exWriteTableHeader(ws, headers, row - 1);
    const tableStartRow = row;
    row++;

    const numCols = new Set([3, 6, 7, 8]);
    const currencyCols = new Set([9, 10]);

    p.materials.forEach(rec => {
      const product = rec.productId ? (productMap.get(rec.productId) ?? rec.productId) : '—';
      const lineName = lineMap.get(rec.lineId) ?? `Line ${rec.lineId.substring(0, 8)}`;
      if (rec.materials?.length) {
        rec.materials.forEach(item => {
          const eff = this.effectiveItemCost(p, item);
          const standardOk = this.materialStandardConfigured(item.perMixStandard);
          this.exWriteTableRow(ws, [
            rec.date, lineName, product, rec.mixCount, item.materialName, item.unit,
            standardOk ? (item.theoreticalQuantity ?? 0) : 'Not Configured',
            item.actualQuantity ?? 0,
            standardOk ? (item.variance ?? 0) : '—',
            eff.unitCost === null ? '—' : eff.unitCost ?? 0,
            eff.totalCost === null ? '—' : eff.totalCost ?? 0
          ], row - 1, numCols, undefined, currencyCols);
          row++;
        });
      } else {
        const cost = rec.totalCost ?? 0;
        this.exWriteTableRow(ws, [
          rec.date, lineName, product, rec.mixCount, '–', '–', 0, 0, 0, cost, cost
        ], row - 1, numCols, undefined, currencyCols);
        row++;
      }
    });

    if (p.materials.length > 0) {
      this.exWriteTotalsRow(ws, [
        'TOTAL', '', '', '', '', '', '', '', '', 'TOTAL COST', grandTotalCost
      ], row - 1, new Set([10]));
      row++;
    } else {
      row = this.exWriteNoData(ws, row, COLS);
    }

    this.exFinalizeSheet(ws, [12, 18, 18, 11, 16, 8, 15, 12, 10, 11, 12], 7, {
      s: { r: tableStartRow - 1, c: 0 },
      e: { r: row - 2, c: COLS - 1 }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Materials');
  }

  // ─── Quality Sheet ─────────────────────────────────────────────────────────

  private exAddQualitySheet(wb: XLSX.WorkBook, p: ReportParams, sheetTitle = 'Quality Report'): void {
    const lineMap = this.buildMap(p.lines);
    const COLS = 16;

    const stats = this.qualityStats(p.qualityTests);

    const ws = XLSX.utils.aoa_to_sheet([]);
    let row = this.exWriteReportHeader(ws, sheetTitle, p, COLS);
    row++;

    row = this.exWriteKpiRow(ws,
      ['Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Sample Pass Rate', ''],
      [stats.recorded, stats.assessed, stats.passed, stats.failed, `${stats.passRate}%`, ''],
      row
    );
    row++;

    row = this.exWriteSectionTitle(ws, 'QUALITY TEST RESULTS', row, COLS);

    const headers = ['Date', 'Product', 'Line', 'Test Date', 'Sample', 'Act Ht', 'Std Ht', 'Ht Diff', 'Act Wt (kg)', 'Std Wt (kg)', 'Wt Diff (kg)', 'Load (kN)', 'Area (cm²)', 'Compression', 'Comp Std', 'Result'];
    this.exWriteTableHeader(ws, headers, row - 1);
    const tableStartRow = row;
    row++;
    let detailRows = 0;

    const writeDetailRow = (values: (string | number)[], average: boolean) => {
      const alt = (row - 1) % 2 === 0 || average;
      values.forEach((val, i) => {
        const ref = XLSX.utils.encode_cell({ r: row - 1, c: i });
        const isNum = !average && typeof val === 'number';
        ws[ref] = { v: val, t: isNum ? 'n' : 's' };

        if (average) {
          this.exStyle(ws, ref, this.exAverageStyle());
        } else if (i === 15) {
          if (val === 'PASS') {
            this.exStyle(ws, ref, this.exPassStyle());
          } else if (val === 'CONFIGURATION_REQUIRED') {
            this.exStyle(ws, ref, this.exConfigRequiredStyle());
          } else {
            this.exStyle(ws, ref, this.exFailStyle());
          }
        } else if (i === 13) {
          this.exStyle(ws, ref, this.exTableDecimalStyle(alt));
        } else if (isNum) {
          this.exStyle(ws, ref, this.exTableNumericStyle(alt));
        } else {
          this.exStyle(ws, ref, this.exTableDataStyle(alt));
        }
      });
      ws['!rows'] = ws['!rows'] || [];
      ws['!rows'][row - 1] = { hpt: 18 };
      row++;
      detailRows++;
    };

    p.qualityTests.forEach(q => {
      const lineName = q.lineName ?? lineMap.get(q.lineId ?? '') ?? 'Not specified';
      const samples = (q.samples && q.samples.length > 0) ? q.samples : [null];
      samples.forEach(s => {
        writeDetailRow([
          q.date, q.productName ?? '', lineName, q.testDate,
          s ? `Sample ${s.sampleNumber}` : '—',
          s ? s.actualHeight : '',
          s ? (q.standardHeightSnapshot ?? '') : '',
          s ? (s.heightDifference ?? '') : '',
          s ? s.actualWeight : '',
          s ? (q.standardWeightSnapshot ?? '') : '',
          s ? (s.weightDifference ?? '') : '',
          s ? s.load : (q.load ?? q.strength ?? 0),
          q.productAreaSnapshot ?? 0,
          s ? s.compression : (q.compression ?? q.strength ?? 0),
          q.compressionStandardSnapshot ?? q.standardStrength ?? 0,
          s ? s.compressionResult : (q.result ?? '')
        ], false);
      });
      const avg = this.qualityAverageRow(q, lineName);
      if (avg) {
        writeDetailRow(avg, true);
      }
    });

    if (detailRows === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }

    row = this.exWriteSectionTitle(ws, 'QUALITY SUMMARY', row, COLS);

    this.exWriteTableHeader(ws, ['Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Samples Pending Configuration', 'Sample Pass Rate'], row - 1);
    row++;
    this.exWriteTableRow(ws, [stats.recorded, stats.assessed, stats.passed, stats.failed, stats.recorded - stats.assessed, `${stats.passRate}%`], row - 1, new Set([0, 1, 2, 3]));
    row++;

    this.exFinalizeSheet(ws, [12, 18, 14, 12, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 9, 10], 15, {
      s: { r: tableStartRow - 1, c: 0 },
      e: { r: tableStartRow + detailRows - 1, c: COLS - 1 }
    });

    XLSX.utils.book_append_sheet(wb, ws, sheetTitle === 'Daily Quality Detail' ? 'Daily Quality Detail' : 'Quality');
  }

  /**
   * Complete report Quality sheet — a concise Management Quality Summary instead
   * of the detailed 16-col table (which stays with the dedicated Quality report).
   * One row per Line + Product: Recorded/Assessed/Passed/Failed + ACTUAL-value
   * averages + pass rate. Pass/fail remain compression-only.
   */
  private exAddQualityManagementSheet(wb: XLSX.WorkBook, p: ReportParams): void {
    const COLS = 11;
    const stats = this.qualityStats(p.qualityTests);
    const rows = this.buildQualityManagementRows(p);

    const ws = XLSX.utils.aoa_to_sheet([]);
    let row = this.exWriteReportHeader(ws, 'Quality Report', p, COLS);
    row++;

    row = this.exWriteKpiRow(ws,
      ['Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Sample Pass Rate', '', '', '', '', '', ''],
      [stats.recorded, stats.assessed, stats.passed, stats.failed, `${stats.passRate}%`, '', '', '', '', '', ''],
      row
    );
    row++;

    row = this.exWriteSectionTitle(ws, 'QUALITY MANAGEMENT SUMMARY', row, COLS);
    this.exWriteTableHeader(ws, ['Line', 'Product', 'Samples Recorded', 'Samples Assessed', 'Avg Actual Height', 'Avg Actual Weight', 'Avg Load', 'Avg Compression', 'Samples Passed', 'Samples Failed', 'Sample Pass Rate'], row - 1);
    row++;
    const tableStartRow = row;
    rows.forEach(r => {
      this.exWriteTableRow(ws, [
        r.lineName, r.productName, r.recorded, r.assessed,
        r.avgHeight ?? '—', r.avgWeight ?? '—', r.avgLoad ?? '—', r.avgCompression ?? '—',
        r.passed, r.failed, `${r.passRate}%`
      ], row - 1, new Set([2, 3, 8, 9]));
      row++;
    });
    if (rows.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }

    this.exFinalizeSheet(ws, [18, 18, 15, 15, 13, 13, 12, 14, 14, 14, 14], 7, {
      s: { r: tableStartRow - 1, c: 0 },
      e: { r: Math.max(tableStartRow, row - 2), c: COLS - 1 }
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Quality');
  }

  // ─── Daily / Monthly Operational Report Builder Helpers ─────────────────────

  private buildOperationKpis(p: ReportParams): ReportOperationKpis {
    let presses = 0;
    let produced = 0;
    p.productions.forEach(pr => {
      presses += pr.presses || 0;
      produced += pr.produced || 0;
    });
    const released = p.releases.reduce((s, r) => s + (r.releasedQuantity || 0), 0);
    const mixes = p.materials.reduce((s, m) => s + (m.mixCount || 0), 0);
    const cementKg = this.materialKgByName(p, 'Cement');
    const sandKg = this.materialKgByName(p, 'Sand');
    const aggregateKg = this.materialKgByName(p, 'Aggregate');
    const waterL = this.materialKgByName(p, 'Water');

    let downtime = 0;
    const time = this.timeAggregate(p);
    const q = this.qualityStats(p.qualityTests);

    return {
      presses, produced, released, mixes, cementKg, sandKg,
      sandM3: this.cubicDisplay(sandKg, this.conversionFactorByName('Sand', p.materialsMaster)),
      aggregateKg,
      aggregateM3: this.cubicDisplay(aggregateKg, this.conversionFactorByName('Aggregate', p.materialsMaster)),
      waterL, downtime: time.totalDowntimeMinutes, timeEfficiency: Number(time.timeEfficiency),
      qualityRecorded: q.recorded,
      qualityAssessed: q.assessed,
      qualityPassed: q.passed,
      qualityFailed: q.failed,
      qualityRate: q.passRate
    };
  }

  /**
   * Report kg → m³ via the configured per-material factor (Material master).
   * A missing/zero factor yields CONFIGURATION_REQUIRED — never a fabricated
   * number. Stored kg values are NEVER mutated.
   */
  private cubicDisplay(kg: number, factor: number | undefined): number | typeof CONFIGURATION_REQUIRED {
    if (kg <= 0) return 0;
    const res = MaterialConversionUtil.kgToM3(kg, factor);
    return res.status === OK ? res.cubicMeters : CONFIGURATION_REQUIRED;
  }

  private conversionFactorByName(name: string, materialsMaster: Material[]): number | undefined {
    const n = name.toLowerCase();
    return materialsMaster.find(m => (m.name || '').toLowerCase() === n)?.conversionKgPerM3;
  }

  private materialKgByName(p: ReportParams, name: string): number {
    const n = name.toLowerCase();
    let total = 0;
    p.materials.forEach(rec => {
      (rec.materials || []).forEach(item => {
        if ((item.materialName || '').toLowerCase() === n) total += item.actualQuantity || 0;
      });
    });
    return total;
  }

  /**
   * True when the stored per-mix standard quantity is a positive configured
   * value. A missing/zero standard means the recipe was NOT configured at entry
   * time — the report must then show 'Not Configured' for Theoretical and '—'
   * for Variance, never 0 or Actual − 0.
   */
  private materialStandardConfigured(perMixStandard: number | undefined): boolean {
    return typeof perMixStandard === 'number' && Number.isFinite(perMixStandard) && perMixStandard > 0;
  }

  // ─── Authoritative time & cost helpers ────────────────────────────────────

  /**
   * AUTHORITATIVE time aggregation. The base available window is 390 minutes per
   * Line per DAY plus overtime*60 — it is NEVER multiplied by the number of
   * products, sessions, records or lines. Entries are grouped by date|lineId so
   * several production rows or sessions for one Line on the same day still yield
   * exactly one 390-minute day per Line.
   */
  private timeAggregate(p: ReportParams): {
    totalAvailableMinutes: number;
    totalActualRunMinutes: number;
    totalDowntimeMinutes: number;
    totalOvertimeHours: number;
    timeEfficiency: string;
  } {
    const byDay = new Map<string, { overtimeHours: number; downtimeMinutes: number }>();
    p.sessions.forEach(s => {
      (s.dailyLineTime || []).forEach(d => {
        const key = `${s.date}_${d.lineId}`;
        const acc = byDay.get(key) ?? { overtimeHours: 0, downtimeMinutes: 0 };
        acc.overtimeHours += d.overtimeHours || 0;
        acc.downtimeMinutes += d.downtimeMinutes || 0;
        byDay.set(key, acc);
      });
    });

    let available = 0, run = 0, downtime = 0, overtime = 0;
    byDay.forEach(day => {
      const eff = EfficiencyUtil.calculateEfficiency(day.overtimeHours, day.downtimeMinutes);
      available += eff.availableMinutes;
      run += eff.actualRunMinutes;
      downtime += day.downtimeMinutes;
      overtime += day.overtimeHours;
    });
    const timeEfficiency = available > 0 ? ((run / available) * 100).toFixed(1) : '0.0';
    return {
      totalAvailableMinutes: available,
      totalActualRunMinutes: run,
      totalDowntimeMinutes: downtime,
      totalOvertimeHours: overtime,
      timeEfficiency
    };
  }

  /** Same authoritative rule scoped to one Line (used for per-line rows). */
  private lineTimeAggregate(p: ReportParams, lineId: string): {
    availableMinutes: number;
    actualRunMinutes: number;
    timeEfficiency: number;
  } {
    const byDay = new Map<string, { overtimeHours: number; downtimeMinutes: number }>();
    p.sessions.forEach(s => {
      (s.dailyLineTime || []).forEach(d => {
        if (d.lineId !== lineId) return;
        const key = `${s.date}_${d.lineId}`;
        const acc = byDay.get(key) ?? { overtimeHours: 0, downtimeMinutes: 0 };
        acc.overtimeHours += d.overtimeHours || 0;
        acc.downtimeMinutes += d.downtimeMinutes || 0;
        byDay.set(key, acc);
      });
    });

    let available = 0, run = 0;
    byDay.forEach(day => {
      const eff = EfficiencyUtil.calculateEfficiency(day.overtimeHours, day.downtimeMinutes);
      available += eff.availableMinutes;
      run += eff.actualRunMinutes;
    });
    return {
      availableMinutes: available,
      actualRunMinutes: run,
      timeEfficiency: available > 0 ? (run / available) * 100 : 0
    };
  }

  /**
   * Demo (business-unverified) unit-costs never appear in operational reports.
   * Their price cells render as '—' and their cost is excluded from every total;
   * the master config itself is never touched.
   */
  private isDemoCost(p: ReportParams, materialId?: string): boolean {
    if (!materialId) return false;
    return (p.unitCostsMaster ?? []).some(c => c.materialId === materialId && c.demo === true);
  }

  /** Effective item cost; null when the item's unit cost is demo/unverified. */
  private effectiveItemCost(p: ReportParams, item: { materialId?: string; unitCost?: number; totalCost?: number }):
    { unitCost: number | null; totalCost: number | null } {
    if (this.isDemoCost(p, item.materialId)) {
      return { unitCost: null, totalCost: null };
    }
    return { unitCost: item.unitCost ?? 0, totalCost: item.totalCost ?? 0 };
  }

  /** Effective record cost: item totals minus demo-priced items (legacy non-itemized cost kept). */
  private effectiveRecordCost(p: ReportParams, rec: MaterialRecord): number {
    if ((rec.materials || []).length > 0) {
      return (rec.materials || []).reduce((s, it) => s + (this.effectiveItemCost(p, it).totalCost ?? 0), 0);
    }
    return rec.totalCost || 0;
  }

  /**
   * Product-level Production vs Released Output.
   * Independent transactions — NO genealogy implied. Legacy releases without a
   * productId are labeled "Unattributed Release" (never invented onto a product).
   */
  private buildProductBreakdown(p: ReportParams): ReportProductBreakdownRow[] {
    const productMap = this.buildMap(p.products);
    const rows = new Map<string, ReportProductBreakdownRow>();
    const keyOf = (productId?: string): string =>
      productId ? (productMap.get(productId) ?? `Product ${productId.substring(0, 8)}`) : 'Unattributed Release';

    p.productions.forEach(pr => {
      const key = keyOf(pr.productId);
      const row = rows.get(key) ?? { productName: key, presses: 0, produced: 0, releasedOutput: 0 };
      row.presses += pr.presses || 0;
      row.produced += pr.produced || 0;
      rows.set(key, row);
    });

    p.releases.forEach(r => {
      const key = keyOf(r.productId);
      const row = rows.get(key) ?? { productName: key, presses: 0, produced: 0, releasedOutput: 0 };
      row.releasedOutput += r.releasedQuantity || 0;
      rows.set(key, row);
    });

    return Array.from(rows.values())
      .sort((a, b) => (b.produced + b.releasedOutput) - (a.produced + a.releasedOutput));
  }

  /**
   * Production + Released Output comparison rows (per date / line / product).
   * Unions both transactions so a manager can read production output and
   * released output side by side without implying traceability.
   */
  private buildProductionOutput(p: ReportParams): ReportProductionOutputRow[] {
    const productMap = this.buildMap(p.products);
    const lineMap = this.buildMap(p.lines);
    const map = new Map<string, ReportProductionOutputRow>();
    const keyOf = (productId?: string): string =>
      productId ? (productMap.get(productId) ?? `Product ${productId.substring(0, 8)}`) : 'Unattributed Release';

    p.productions.forEach(pr => {
      const key = `${pr.date}|${pr.lineId}|${keyOf(pr.productId)}`;
      const entry = map.get(key) ?? {
        date: pr.date,
        lineName: lineMap.get(pr.lineId) ?? pr.lineId,
        productName: keyOf(pr.productId),
        presses: 0, produced: 0, releasedOutput: 0
      };
      entry.presses += pr.presses || 0;
      entry.produced += pr.produced || 0;
      map.set(key, entry);
    });

    p.releases.forEach(r => {
      const lineKey = r.lineId ?? '';
      const key = `${r.releaseDate.substring(0, 10)}|${lineKey}|${keyOf(r.productId)}`;
      const entry = map.get(key) ?? {
        date: r.releaseDate.substring(0, 10),
        lineName: r.lineId ? (lineMap.get(r.lineId) ?? r.lineId) : 'Unknown Line',
        productName: keyOf(r.productId),
        presses: 0, produced: 0, releasedOutput: 0
      };
      entry.releasedOutput += r.releasedQuantity || 0;
      map.set(key, entry);
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date) || a.lineName.localeCompare(b.lineName));
  }

  /**
   * Per-line operational rows for the daily/monthly reports. Lines appear when
   * they have ANY activity (production, release, materials, quality, downtime
   * or overtime). Multi-product lines carry a full product breakdown.
   * Time efficiency is delegated to EfficiencyUtil (authoritative).
   */
  private buildLineOperations(p: ReportParams): ReportLineOpsRow[] {
    const lineNameMap = this.buildMap(p.lines);
    const productMap = this.buildMap(p.products);
    const shiftMap = this.buildMap(p.shifts);
    const sessionMap = this.buildSessionMap(p.sessions);

    const rows = new Map<string, ReportLineOpsRow>();
    const shiftIds = new Map<string, Set<string>>();

    const rowOf = (lineId: string, fallbackName?: string): ReportLineOpsRow => {
      let row = rows.get(lineId);
      if (!row) {
        row = {
          lineId,
          lineName: lineNameMap.get(lineId) ?? fallbackName ?? `Line ${lineId.substring(0, 8)}`,
          products: [], productLabel: '', pressedProductsLabel: '', releasedProductsLabel: '', shiftsLabel: '',
          presses: 0, produced: 0, releasedOutput: 0, mixCount: 0,
          cementKg: 0, sandKg: 0, sandM3: 0, aggregateKg: 0, aggregateM3: 0, waterL: 0,
          downtimeMinutes: 0, overtimeHours: 0,
          availableMinutes: 0, actualRunMinutes: 0, timeEfficiency: 0,
          samples: 0, passed: 0, failed: 0
        };
        rows.set(lineId, row);
        shiftIds.set(lineId, new Set<string>());
      }
      return row;
    };

    const upsertProduct = (row: ReportLineOpsRow, productName: string, presses: number, produced: number, releasedOutput: number) => {
      const existing = row.products.find(pd => pd.productName === productName);
      if (existing) {
        existing.presses += presses;
        existing.produced += produced;
        existing.releasedOutput += releasedOutput;
      } else {
        row.products.push({ productName, presses, produced, releasedOutput });
      }
    };

    const productNameOf = (productId?: string): string =>
      productId ? (productMap.get(productId) ?? `Product ${productId.substring(0, 8)}`) : 'Unattributed Release';

    p.productions.forEach(pr => {
      const row = rowOf(pr.lineId);
      row.presses += pr.presses || 0;
      row.produced += pr.produced || 0;
      upsertProduct(row, productNameOf(pr.productId), pr.presses || 0, pr.produced || 0, 0);
      const session = this.findSession(pr, sessionMap);
      if (session?.shiftId) shiftIds.get(row.lineId)!.add(session.shiftId);
    });

    p.releases.forEach(r => {
      if (!r.lineId) return;
      const row = rowOf(r.lineId);
      row.releasedOutput += r.releasedQuantity || 0;
      upsertProduct(row, productNameOf(r.productId), 0, 0, r.releasedQuantity || 0);
    });

    p.materials.forEach(rec => {
      if (!rec.lineId) return;
      const row = rowOf(rec.lineId);
      row.mixCount += rec.mixCount || 0;
      if (rec.shiftId) shiftIds.get(row.lineId)!.add(rec.shiftId);
      (rec.materials || []).forEach(item => {
        const name = (item.materialName || '').toLowerCase();
        if (name === 'cement') row.cementKg += item.actualQuantity || 0;
        else if (name === 'sand') row.sandKg += item.actualQuantity || 0;
        else if (name === 'aggregate') row.aggregateKg += item.actualQuantity || 0;
        else if (name === 'water') row.waterL += item.actualQuantity || 0;
      });
    });

    p.qualityTests.forEach(q => {
      if (!q.lineId) return;
      const row = rowOf(q.lineId);
      const samples = (q.samples || []).filter(s => !!s);
      if (samples.length > 0) {
        row.samples += samples.length;
        samples.forEach(s => {
          if (s.compressionResult === 'PASS') row.passed++;
          else if (s.compressionResult === 'FAIL') row.failed++;
        });
      } else {
        row.samples += 1;
        if (q.result === 'PASS') row.passed++;
        else if (q.result === 'FAIL') row.failed++;
      }
    });

    p.sessions.forEach(s => {
      (s.dailyLineTime || []).forEach(d => {
        const row = rowOf(d.lineId, d.lineName);
        row.downtimeMinutes += d.downtimeMinutes || 0;
        row.overtimeHours += d.overtimeHours || 0;
        if (s.shiftId) shiftIds.get(row.lineId)!.add(s.shiftId);
      });
    });

    const result = Array.from(rows.values());
    result.forEach(row => {
      const eff = this.lineTimeAggregate(p, row.lineId);
      row.availableMinutes = eff.availableMinutes;
      row.actualRunMinutes = eff.actualRunMinutes;
      row.timeEfficiency = eff.timeEfficiency;
      row.sandM3 = this.cubicDisplay(row.sandKg, this.conversionFactorByName('Sand', p.materialsMaster));
      row.aggregateM3 = this.cubicDisplay(row.aggregateKg, this.conversionFactorByName('Aggregate', p.materialsMaster));
      row.products.sort((a, b) => (b.produced + b.releasedOutput) - (a.produced + a.releasedOutput));
      const pressed = row.products.filter(pd => (pd.produced || 0) > 0);
      const released = row.products.filter(pd => (pd.releasedOutput || 0) > 0);
      row.productLabel = row.products.map(pd => pd.productName).join(', ') || '—';
      row.pressedProductsLabel = pressed.length > 0 ? pressed.map(pd => pd.productName).join(', ') : '—';
      row.releasedProductsLabel = released.length > 0 ? released.map(pd => pd.productName).join(', ') : '—';
      row.shiftsLabel = Array.from(shiftIds.get(row.lineId) ?? [])
        .map(id => shiftMap.get(id) ?? id)
        .filter(Boolean)
        .join(', ') || '—';
    });

    return result.sort((a, b) => a.lineName.localeCompare(b.lineName));
  }

  private buildMaterialUsageRows(p: ReportParams): ReportMaterialUsageRow[] {
    const lineMap = this.buildMap(p.lines);
    return p.materials.map(rec => {
      let cementKg = 0, sandKg = 0, aggregateKg = 0, waterL = 0;
      (rec.materials || []).forEach(item => {
        const name = (item.materialName || '').toLowerCase();
        if (name === 'cement') cementKg += item.actualQuantity || 0;
        else if (name === 'sand') sandKg += item.actualQuantity || 0;
        else if (name === 'aggregate') aggregateKg += item.actualQuantity || 0;
        else if (name === 'water') waterL += item.actualQuantity || 0;
      });
      return {
        date: rec.date,
        lineId: rec.lineId,
        lineName: lineMap.get(rec.lineId) ?? `Line ${rec.lineId.substring(0, 8)}`,
        mixCount: rec.mixCount || 0,
        cementKg, sandKg,
        sandM3: this.cubicDisplay(sandKg, this.conversionFactorByName('Sand', p.materialsMaster)),
        aggregateKg,
        aggregateM3: this.cubicDisplay(aggregateKg, this.conversionFactorByName('Aggregate', p.materialsMaster)),
        waterL
      };
    });
  }

  private buildLineMaterialRows(p: ReportParams): ReportLineMaterialRow[] {
    const lineMap = this.buildMap(p.lines);
    const map = new Map<string, ReportLineMaterialRow>();
    p.materials.forEach(rec => {
      const row = map.get(rec.lineId) ?? {
        lineId: rec.lineId,
        lineName: lineMap.get(rec.lineId) ?? `Line ${rec.lineId.substring(0, 8)}`,
        mixCount: 0, cementKg: 0, sandKg: 0, sandM3: 0, aggregateKg: 0, aggregateM3: 0, waterL: 0
      };
      row.mixCount += rec.mixCount || 0;
      (rec.materials || []).forEach(item => {
        const name = (item.materialName || '').toLowerCase();
        if (name === 'cement') row.cementKg += item.actualQuantity || 0;
        else if (name === 'sand') row.sandKg += item.actualQuantity || 0;
        else if (name === 'aggregate') row.aggregateKg += item.actualQuantity || 0;
        else if (name === 'water') row.waterL += item.actualQuantity || 0;
      });
      map.set(rec.lineId, row);
    });
    const rows = Array.from(map.values());
    rows.forEach(row => {
      row.sandM3 = this.cubicDisplay(row.sandKg, this.conversionFactorByName('Sand', p.materialsMaster));
      row.aggregateM3 = this.cubicDisplay(row.aggregateKg, this.conversionFactorByName('Aggregate', p.materialsMaster));
    });
    return rows.sort((a, b) => a.lineName.localeCompare(b.lineName));
  }

  // ─── Daily Operational Sheet ────────────────────────────────────────────────

  private exAddDailySheet(wb: XLSX.WorkBook, p: ReportParams): void {
    const COLS = 19;
    const kpis = this.buildOperationKpis(p);
    const breakdown = this.buildProductBreakdown(p);
    const prodOutput = this.buildProductionOutput(p);
    const lines = this.buildLineOperations(p);
    const materials = this.buildMaterialUsageRows(p);

    const ws = XLSX.utils.aoa_to_sheet([]);
    let row = this.exWriteReportHeader(ws, 'Daily Operational Report', p, COLS);
    row++;

    row = this.exWriteKpiRow(ws,
      ['Total Presses', 'Press Production', 'Released Output', 'Total Mixes', 'Cement (kg)', 'Sand (m³)', 'Aggregate (m³)', 'Water (L)'],
      [kpis.presses, kpis.produced, kpis.released, kpis.mixes, kpis.cementKg, kpis.sandM3, kpis.aggregateM3, kpis.waterL],
      row
    );
    row = this.exWriteKpiRow(ws,
      ['Total Downtime (min)', 'Time Efficiency (%)', 'Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Samples Pending Configuration', 'Sample Pass Rate (%)'],
      [kpis.downtime, `${kpis.timeEfficiency.toFixed(1)}%`, kpis.qualityRecorded, kpis.qualityAssessed, kpis.qualityPassed, kpis.qualityFailed, kpis.qualityRecorded - kpis.qualityAssessed, `${kpis.qualityRate}%`],
      row
    );
    row++;

    row = this.exWriteSectionTitle(ws, 'PRODUCTION BY PRODUCT (INDEPENDENT OF RELEASES)', row, COLS);
    this.exWriteTableHeader(ws, ['Product', 'Presses', 'Press Production', 'Released Output'], row - 1);
    row++;
    breakdown.forEach(b => {
      this.exWriteTableRow(ws, [b.productName, b.presses, b.produced, b.releasedOutput], row - 1, new Set([1, 2, 3]));
      row++;
    });
    if (breakdown.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }
    row++;

    row = this.exWriteSectionTitle(ws, 'PRODUCTION + OUTPUT', row, COLS);
    this.exWriteTableHeader(ws, ['Date', 'Line', 'Product', 'Presses', 'Press Production', 'Released Output'], row - 1);
    row++;
    prodOutput.forEach(po => {
      this.exWriteTableRow(ws, [po.date, po.lineName, po.productName, po.presses, po.produced, po.releasedOutput], row - 1, new Set([3, 4, 5]));
      row++;
    });
    if (prodOutput.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }
    row++;

    row = this.exWriteSectionTitle(ws, 'LINE-LEVEL OPERATIONS', row, COLS);
    this.exWriteTableHeader(ws, ['Line', 'Pressed Product(s)', 'Released Product(s)', 'Shift', 'Presses', 'Produced', 'Released', 'Mix Count', 'Cement (kg)', 'Sand (m³)', 'Aggregate (m³)', 'Water (L)', 'Downtime (min)', 'Available (min)', 'Actual Run (min)', 'Time Eff (%)', 'Samples', 'Passed', 'Failed'], row - 1);
    row++;
    lines.forEach(line => {
      this.exWriteTableRow(ws, [
        line.lineName, line.pressedProductsLabel, line.releasedProductsLabel, line.shiftsLabel,
        line.presses, line.produced, line.releasedOutput, line.mixCount,
        line.cementKg, line.sandM3, line.aggregateM3, line.waterL,
        line.downtimeMinutes, line.availableMinutes, line.actualRunMinutes,
        `${line.timeEfficiency.toFixed(1)}%`, line.samples, line.passed, line.failed
      ], row - 1, new Set([4, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18]));
      row++;
    });
    if (lines.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }
    row++;

    row = this.exWriteSectionTitle(ws, 'MATERIALS BY RECORD (kg RETAINED FOR AUDIT)', row, COLS);
    this.exWriteTableHeader(ws, ['Date', 'Line', 'Mix Count', 'Cement (kg)', 'Sand (kg)', 'Sand (m³)', 'Aggregate (kg)', 'Aggregate (m³)', 'Water (L)'], row - 1);
    row++;
    materials.forEach(m => {
      this.exWriteTableRow(ws, [m.date, m.lineName, m.mixCount, m.cementKg, m.sandKg, m.sandM3, m.aggregateKg, m.aggregateM3, m.waterL], row - 1, new Set([2, 3, 4, 7, 8]));
      row++;
    });
    if (materials.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }

    this.exFinalizeSheet(ws, [13, 20, 20, 12, 10, 10, 10, 10, 11, 11, 12, 11, 14, 14, 14, 11, 9, 9, 9], 7);
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Operational');
  }

  // ─── Monthly Operational Sheet ──────────────────────────────────────────────

  private exAddMonthlySheet(wb: XLSX.WorkBook, p: ReportParams): void {
    const COLS = 19;
    const kpis = this.buildOperationKpis(p);
    const breakdown = this.buildProductBreakdown(p);
    const lines = this.buildLineOperations(p);
    const materials = this.buildLineMaterialRows(p);
    const q = this.qualityStats(p.qualityTests);
    const monthLabel = p.range.startDate.substring(0, 7);

    const ws = XLSX.utils.aoa_to_sheet([]);
    let row = this.exWriteReportHeader(ws, 'Monthly Operational Report', p, COLS);
    row++;

    row = this.exWriteKpiRow(ws,
      ['Total Presses', 'Total Produced', 'Released Output', 'Total Mixes', 'Cement (kg)', 'Sand (m³)', 'Aggregate (m³)', 'Water (L)'],
      [kpis.presses, kpis.produced, kpis.released, kpis.mixes, kpis.cementKg, kpis.sandM3, kpis.aggregateM3, kpis.waterL],
      row
    );
    row = this.exWriteKpiRow(ws,
      ['Total Downtime (min)', 'Time Efficiency (%)', 'Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Samples Pending Configuration', 'Sample Pass Rate (%)'],
      [kpis.downtime, `${kpis.timeEfficiency.toFixed(1)}%`, q.recorded, q.assessed, q.passed, q.failed, q.recorded - q.assessed, `${q.passRate}%`],
      row
    );
    row++;

    row = this.exWriteSectionTitle(ws, 'MONTHLY PRODUCTION + OUTPUT BY PRODUCT', row, COLS);
    this.exWriteTableHeader(ws, ['Product', 'Total Presses', 'Total Produced', 'Total Released'], row - 1);
    row++;
    breakdown.forEach(b => {
      this.exWriteTableRow(ws, [b.productName, b.presses, b.produced, b.releasedOutput], row - 1, new Set([1, 2, 3]));
      row++;
    });
    if (breakdown.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }
    row++;

    row = this.exWriteSectionTitle(ws, 'MONTHLY LINE SUMMARY', row, COLS);
    this.exWriteTableHeader(ws, ['Line', 'Pressed Product(s)', 'Released Product(s)', 'Shift', 'Presses', 'Produced', 'Released', 'Mix Count', 'Cement (kg)', 'Sand (m³)', 'Aggregate (m³)', 'Water (L)', 'Downtime (min)', 'Available (min)', 'Actual Run (min)', 'Time Eff (%)', 'Samples', 'Passed', 'Failed'], row - 1);
    row++;
    lines.forEach(line => {
      this.exWriteTableRow(ws, [
        line.lineName, line.pressedProductsLabel, line.releasedProductsLabel, line.shiftsLabel,
        line.presses, line.produced, line.releasedOutput, line.mixCount,
        line.cementKg, line.sandM3, line.aggregateM3, line.waterL,
        line.downtimeMinutes, line.availableMinutes, line.actualRunMinutes,
        `${line.timeEfficiency.toFixed(1)}%`, line.samples, line.passed, line.failed
      ], row - 1, new Set([4, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18]));
      row++;
    });
    if (lines.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }
    row++;

    row = this.exWriteSectionTitle(ws, 'MONTHLY MATERIALS BY LINE', row, COLS);
    this.exWriteTableHeader(ws, ['Month', 'Line', 'Mix Count', 'Cement (kg)', 'Sand (kg)', 'Sand (m³)', 'Aggregate (kg)', 'Aggregate (m³)', 'Water (L)'], row - 1);
    row++;
    materials.forEach(m => {
      this.exWriteTableRow(ws, [monthLabel, m.lineName, m.mixCount, m.cementKg, m.sandKg, m.sandM3, m.aggregateKg, m.aggregateM3, m.waterL], row - 1, new Set([2, 3, 4, 7, 8]));
      row++;
    });
    if (materials.length === 0) {
      row = this.exWriteNoData(ws, row, COLS);
    }
    row++;

    row = this.exWriteSectionTitle(ws, 'MONTHLY QUALITY SUMMARY', row, COLS);
    this.exWriteTableHeader(ws, ['Samples Recorded', 'Samples Assessed', 'Samples Passed', 'Samples Failed', 'Samples Pending Configuration', 'Sample Pass Rate'], row - 1);
    row++;
    this.exWriteTableRow(ws, [q.recorded, q.assessed, q.passed, q.failed, q.recorded - q.assessed, `${q.passRate}%`], row - 1, new Set([0, 1, 2, 3]));

    this.exFinalizeSheet(ws, [13, 20, 20, 12, 10, 10, 10, 10, 11, 11, 12, 11, 14, 14, 14, 11, 9, 9, 9], 7);
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Operational');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  private generatePdf(p: ReportParams): void {
    const doc = this.buildPdfDoc(p);
    const filename = this.buildFilename(p, 'pdf');
    doc.save(filename);
  }

  private buildPdfDoc(p: ReportParams): jsPDF {
    const landscape = p.type === 'daily' || p.type === 'monthly' || p.type === 'quality';
    const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

    switch (p.type) {
      case 'production': this.buildPdfProduction(doc, p); break;
      case 'materials':  this.buildPdfMaterials(doc, p); break;
      case 'quality':    this.buildPdfQuality(doc, p); break;
      case 'complete':   this.buildPdfComplete(doc, p); break;
      case 'daily':      this.buildPdfDaily(doc, p); break;
      case 'monthly':    this.buildPdfMonthly(doc, p); break;
    }

    return doc;
  }

  // ─── PDF Header ────────────────────────────────────────────────────────────

  private drawHeader(doc: jsPDF, title: string): void {
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(...this.BRAND_DARK);
    doc.rect(0, 0, pageW, 32, 'F');

    doc.setFillColor(...this.BRAND_GOLD);
    doc.rect(0, 32, pageW, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...this.WHITE);
    doc.text('TPMS', 14, 16);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 170, 155);
    doc.text('Production Management System', 14, 23);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.WHITE);
    doc.text(title.toUpperCase(), pageW - 14, 16, { align: 'right' });

    const refNo = `RPT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 170, 155);
    doc.text(`Ref: ${refNo}`, pageW - 14, 23, { align: 'right' });
  }

  // ─── PDF Metadata ──────────────────────────────────────────────────────────

  private drawMetadata(doc: jsPDF, p: ReportParams, title: string, startY: number): number {
    const pageW = doc.internal.pageSize.getWidth();
    const x = 14;
    let y = startY;

    doc.setFillColor(...this.LIGHT_BG);
    doc.roundedRect(x, y, pageW - 28, 18, 2, 2, 'F');
    doc.setDrawColor(...this.TABLE_BORDER);
    doc.roundedRect(x, y, pageW - 28, 18, 2, 2, 'S');

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...this.TEXT_MED);
    doc.text('Report Period:', x + 4, y);
    doc.setTextColor(...this.TEXT_DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(`${this.fmtDate(p.range.startDate)} – ${this.fmtDate(p.range.endDate)}`, x + 30, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.TEXT_MED);
    doc.text('Generated:', x + 4, y);
    doc.setTextColor(...this.TEXT_DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(this.fmtDate(new Date().toISOString().substring(0, 10)), x + 30, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.TEXT_MED);
    doc.text('Report Type:', pageW / 2 + 5, y - 7);
    doc.setTextColor(...this.BRAND_DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageW / 2 + 28, y - 7);

    return y + 10;
  }

  // ─── PDF Summary Cards ─────────────────────────────────────────────────────

  private drawSummaryCards(doc: jsPDF, cards: { label: string; value: string; color: [number, number, number] }[], startY: number): number {
    const pageW = doc.internal.pageSize.getWidth();
    const x = 14;
    const availableW = pageW - 28;
    const cols = cards.length <= 3 ? cards.length : Math.min(cards.length, 3);
    const gap = 4;
    const cardW = (availableW - (cols - 1) * gap) / cols;
    const cardH = 22;

    let y = startY;
    cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x + col * (cardW + gap);
      const cy = y + row * (cardH + gap);

      doc.setFillColor(...this.WHITE);
      doc.setDrawColor(...this.TABLE_BORDER);
      doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');

      doc.setFillColor(...card.color);
      doc.rect(cx, cy, 3, cardH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...this.TEXT_DARK);
      doc.text(card.value, cx + 8, cy + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...this.TEXT_MED);
      doc.text(card.label, cx + 8, cy + 16);
    });

    const totalRows = Math.ceil(cards.length / cols);
    return y + totalRows * (cardH + gap) + 4;
  }

  // ─── PDF Table Helper ──────────────────────────────────────────────────────

  private drawTable(doc: jsPDF, head: string[][], body: string[][], startY: number, columnStylesOverride?: Record<number, object>, avoidRowSplit = false): number {
    autoTable(doc, {
      head,
      body,
      startY,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: this.TEXT_DARK,
        lineColor: this.TABLE_BORDER,
        lineWidth: 0.2,
        font: 'helvetica'
      },
      headStyles: {
        fillColor: this.TABLE_HEADER_BG,
        textColor: this.WHITE,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 3,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: this.TABLE_ALT_ROW
      },
      bodyStyles: {
        halign: 'left',
        valign: 'middle'
      },
      columnStyles: {
        ...this.buildColumnStyles(head[0]?.length ?? 0),
        ...(columnStylesOverride ?? {})
      },
      ...(avoidRowSplit ? { rowPageBreak: 'avoid' as const } : {}),
      didDrawPage: (data) => this.addPageFooter(doc, data.pageNumber)
    });

    return (doc as any).lastAutoTable?.finalY ?? startY;
  }

  private buildColumnStyles(colCount: number): Record<number, object> {
    const styles: Record<number, object> = {};
    const numericCols = new Set([4, 5, 6, 7, 8]);
    for (let i = 0; i < colCount; i++) {
      if (numericCols.has(i)) {
        styles[i] = { halign: 'right' as const };
      }
    }
    return styles;
  }

  /**
   * Quality table header — the confirmed 16 Quality columns. Long labels are kept
   * verbatim so landscape headers read clearly instead of compressed abbreviations.
   */
  private buildQualityHead(): string[][] {
    return [['Date', 'Product', 'Line', 'Test Date', 'Sample',
      'Actual Height', 'Standard Height', 'Height Difference',
      'Actual Weight (kg)', 'Standard Weight (kg)', 'Weight Difference (kg)',
      'Load (kN)', 'Area (cm²)', 'Compression', 'Compression Standard', 'Result']];
  }

  /**
   * Landscape A4 = 297mm wide; 14mm margins each side leave 269mm usable.
   * Explicit widths keep date/number columns single-line, products/lines readable,
   * and PASS / FAIL visible as text; numeric columns are right-aligned.
   */
  private buildQualityColumnStyles(): Record<number, object> {
    const widths: number[] = [
      22, // Date
      24, // Product
      17, // Line
      24, // Test Date
      15, // Sample
      15, // Actual Height
      15, // Standard Height
      15, // Height Difference
      17, // Actual Weight (kg)
      17, // Standard Weight (kg)
      17, // Weight Difference (kg)
      12, // Load (kN)
      11, // Area (m²)
      15, // Compression
      17, // Compression Standard
      14  // Result
    ];
    const styles: Record<number, object> = {};
    widths.forEach((cellWidth, i) => {
      const style: { cellWidth: number; halign?: 'left' | 'right' } = { cellWidth };
      if (i >= 5 && i <= 14) {
        style.halign = 'right';
      }
      styles[i] = style;
    });
    return styles;
  }

  // ─── PDF Section Title ─────────────────────────────────────────────────────

  private drawSectionTitle(doc: jsPDF, title: string, y: number): number {
    doc.setFillColor(...this.BRAND_GOLD);
    doc.rect(14, y, 3, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...this.BRAND_DARK);
    doc.text(title, 21, y + 5.5);

    return y + 13;
  }

  // ─── PDF Footer ────────────────────────────────────────────────────────────

  private addPageFooter(doc: jsPDF, pageNumber: number): void {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setDrawColor(...this.TABLE_BORDER);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...this.TEXT_LIGHT);
    doc.text('Generated by TPMS', 14, pageH - 8);
    doc.text(`Page ${pageNumber}`, pageW - 14, pageH - 8, { align: 'right' });

    doc.setFillColor(...this.BRAND_GOLD);
    doc.rect(0, pageH - 3, pageW, 3, 'F');
  }

  // ─── Check Page Space ──────────────────────────────────────────────────────

  private checkPageBreak(doc: jsPDF, currentY: number, neededHeight: number, p: ReportParams): number {
    const pageH = doc.internal.pageSize.getHeight();
    if (currentY + neededHeight > pageH - 25) {
      doc.addPage();
      return 25;
    }
    return currentY;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF: PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPdfProduction(doc: jsPDF, p: ReportParams): void {
    this.drawHeader(doc, 'Production Report');
    let y = this.drawMetadata(doc, p, 'Production', 40);

    const stats = this.computeStats(p);

    y = this.drawSummaryCards(doc, [
      { label: 'Total Production', value: this.fmtNum(stats.totalProduced), color: this.BRAND_DARK },
      { label: 'Total Presses', value: this.fmtNum(stats.totalPresses), color: this.BRAND_GOLD },
      { label: 'Total Products', value: String(this.countUnique(p.productions, 'productId')), color: [63, 125, 90] },
      { label: 'Total Lines', value: String(this.countUnique(p.productions, 'lineId')), color: [70, 130, 180] },
      { label: 'Total Overtime', value: `${stats.totalOvertime}h`, color: [180, 130, 50] },
      { label: 'Total Downtime', value: `${stats.totalDowntime}m`, color: [160, 82, 45] }
    ], y);

    if (p.productions.length === 0) {
      y = this.drawNoData(doc, y);
    } else {
      y = this.drawSectionTitle(doc, 'Production Details', y);
      const head = [['Date', 'Line', 'Product', 'Shift', 'Supervisor', 'PP', 'Press', 'Produced', 'OT(h)', 'DT(m)', 'DT Reason', 'Notes']];
      const body = this.buildProductionBody(p);
      y = this.drawTable(doc, head, body, y);

      y += 3;
      y = this.checkPageBreak(doc, y, 20, p);
      y = this.drawSectionTitle(doc, 'Production Totals', y);
      y = this.drawTable(doc, [['Metric', 'Value']], [
        ['Total Presses', this.fmtNum(stats.totalPresses)],
        ['Total Produced', this.fmtNum(stats.totalProduced)],
        ['Total Overtime', `${stats.totalOvertime} hrs`],
        ['Total Downtime', `${stats.totalDowntime} min`]
      ], y);
    }
  }

  private buildProductionBody(p: ReportParams): string[][] {
    const productMap = this.buildMap(p.products);
    const shiftMap = this.buildMap(p.shifts);
    const lineMap = this.buildMap(p.lines);
    const sessionMap = this.buildSessionMap(p.sessions);

    return p.productions.map(prod => {
      const session = this.findSession(prod, sessionMap);
      const lineEntry = session?.dailyLineTime?.find(d => d.lineId === prod.lineId);
      return [
        prod.date,
        lineMap.get(prod.lineId) ?? prod.lineId,
        productMap.get(prod.productId) ?? prod.productId,
        shiftMap.get(prod.shiftId) ?? prod.shiftId,
        prod.supervisor ?? '',
        String(prod.piecesPerPress ?? ''),
        String(prod.presses ?? ''),
        String(prod.produced ?? 0),
        lineEntry ? String(lineEntry.overtimeHours || 0) : '',
        lineEntry ? String(lineEntry.downtimeMinutes || 0) : '',
        lineEntry?.downtimeReason ?? '',
        session?.notes ?? ''
      ];
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF: MATERIALS
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPdfMaterials(doc: jsPDF, p: ReportParams): void {
    this.drawHeader(doc, 'Materials Report');
    let y = this.drawMetadata(doc, p, 'Materials', 40);

    const totalMixes = p.materials.reduce((s, m) => s + (m.mixCount || 0), 0);
    const totalCost = p.materials.reduce((s, m) => s + this.effectiveRecordCost(p, m), 0);
    const materialTypes = new Set<string>();
    p.materials.forEach(m => m.materials?.forEach(mi => materialTypes.add(mi.materialName)));
    const lineSummary = this.buildLineMaterialRows(p);

    y = this.drawSummaryCards(doc, [
      { label: 'Total Mixes', value: this.fmtNum(totalMixes), color: this.BRAND_DARK },
      { label: 'Total Cost', value: this.fmtCurrency(totalCost), color: this.BRAND_GOLD },
      { label: 'Material Types', value: String(materialTypes.size), color: [63, 125, 90] },
      { label: 'Batch Records', value: String(p.materials.length), color: [70, 130, 180] }
    ], y);

    if (p.materials.length === 0) {
      y = this.drawNoData(doc, y);
    } else {
      y = this.drawSectionTitle(doc, 'Materials by Line', y);
      y = this.drawTable(doc, [['Line', 'Mixes', 'Cement (kg)', 'Sand (kg)', 'Sand (m³)', 'Agg. (kg)', 'Agg. (m³)', 'Water (L)']],
        lineSummary.map(l => [
          l.lineName, this.fmtNum(l.mixCount), this.fmtNum(l.cementKg),
          this.fmtNum(l.sandKg), this.fmtM3(l.sandM3),
          this.fmtNum(l.aggregateKg), this.fmtM3(l.aggregateM3), this.fmtNum(l.waterL)
        ]), y);

      y += 3;
      y = this.checkPageBreak(doc, y, 16, p);
      y = this.drawSectionTitle(doc, 'Materials Details', y);
      const head = [['Date', 'Line', 'Product', 'Mixes', 'Material', 'Unit', 'Theoretical', 'Actual', 'Variance', 'Unit Cost', 'Total Cost']];
      const body = this.buildMaterialsBody(p);
      y = this.drawTable(doc, head, body, y);

      y += 3;
      y = this.checkPageBreak(doc, y, 16, p);
      y = this.drawSectionTitle(doc, 'Materials Totals', y);
      y = this.drawTable(doc, [['Metric', 'Value']], [
        ['Total Records', String(p.materials.length)],
        ['Total Mixes', this.fmtNum(totalMixes)],
        ['Grand Total Cost', this.fmtCurrency(totalCost)]
      ], y);
    }
  }

  private buildMaterialsBody(p: ReportParams): string[][] {
    const productMap = this.buildMap(p.products);
    const lineMap = this.buildMap(p.lines);
    const rows: string[][] = [];

    p.materials.forEach(rec => {
      const product = rec.productId ? (productMap.get(rec.productId) ?? rec.productId) : '—';
      const lineName = lineMap.get(rec.lineId) ?? `Line ${rec.lineId.substring(0, 8)}`;
      if (rec.materials?.length) {
        rec.materials.forEach(item => {
          const eff = this.effectiveItemCost(p, item);
          const standardOk = this.materialStandardConfigured(item.perMixStandard);
          rows.push([
            rec.date, lineName, product, String(rec.mixCount), item.materialName, item.unit,
            standardOk ? this.fmtNum(item.theoreticalQuantity) : 'Not Configured',
            this.fmtNum(item.actualQuantity),
            standardOk ? this.fmtNum(item.variance) : '—',
            eff.unitCost === null ? '—' : this.fmtCurrency(eff.unitCost),
            eff.totalCost === null ? '—' : this.fmtCurrency(eff.totalCost)
          ]);
        });
      } else {
        const cost = rec.totalCost || 0;
        rows.push([
          rec.date, lineName, product, String(rec.mixCount), '–', '–', '–', '–', '–',
          cost ? this.fmtCurrency(cost) : '—',
          cost ? this.fmtCurrency(cost) : '—'
        ]);
      }
    });

    return rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF: QUALITY
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPdfQuality(doc: jsPDF, p: ReportParams): void {
    this.drawHeader(doc, 'Quality Report');
    let y = this.drawMetadata(doc, p, 'Quality', 40);

    const stats = this.qualityStats(p.qualityTests);

    y = this.drawSummaryCards(doc, [
      { label: 'Samples Recorded', value: String(stats.recorded), color: this.BRAND_DARK },
      { label: 'Samples Passed', value: String(stats.passed), color: this.SUCCESS },
      { label: 'Samples Failed', value: String(stats.failed), color: this.ERROR },
      { label: 'Sample Pass Rate', value: `${stats.passRate}%`, color: this.BRAND_GOLD }
    ], y);

    if (p.qualityTests.length === 0) {
      y = this.drawNoData(doc, y);
    } else {
      y = this.drawSectionTitle(doc, 'Quality Test Results', y);
      const head = this.buildQualityHead();
      const body = this.buildQualityBody(p);
      y = this.drawTable(doc, head, body, y, this.buildQualityColumnStyles(), true);

      y += 3;
      y = this.checkPageBreak(doc, y, 24, p);
      y = this.drawSectionTitle(doc, 'Quality Summary', y);
      y = this.drawQualityMetricsTable(doc, {
        recorded: stats.recorded, assessed: stats.assessed,
        passed: stats.passed, failed: stats.failed, passRate: stats.passRate
      }, y);
    }
  }

  /**
   * Sample-level Quality summary with EXPLICIT denominators:
   *   recorded  — every physically recorded sample (three-sample events count
   *               every stored sample; legacy single-measurement events count one)
   *   assessed  — samples that received a PASS or FAIL verdict
   *   passed    — compressionResult === 'PASS'
   *   failed    — compressionResult === 'FAIL'
   *   passRate  — passed / assessed × 100 (CONFIGURATION_REQUIRED is never a fail)
   */
  private qualityStats(tests: QualityTest[]): { recorded: number; assessed: number; passed: number; failed: number; passRate: string } {
    let recorded = 0;
    let passed = 0;
    let failed = 0;
    tests.forEach(q => {
      const samples = (q.samples || []).filter(s => !!s);
      if (samples.length > 0) {
        recorded += samples.length;
        samples.forEach(s => {
          if (s.compressionResult === 'PASS')      passed++;
          else if (s.compressionResult === 'FAIL') failed++;
        });
      } else {
        recorded += 1;
        if (q.result === 'PASS')      passed++;
        else if (q.result === 'FAIL') failed++;
      }
    });
    const assessed = passed + failed;
    const passRate = assessed > 0 ? ((passed / assessed) * 100).toFixed(1) : '0.0';
    return { recorded, assessed, passed, failed, passRate };
  }

  /**
   * Management Quality Summary rows for the Complete report: one row per
   * Line + Product across the range. Recorded / Assessed / Passed / Failed use
   * the SAME explicit denominators as qualityStats; averages are computed from
   * ACTUAL measurements only (QualityCalculationUtil). Compression averages
   * require a valid stored Compression on every sample (all-or-nothing), so a
   * missing Area / config shows '—' — never a fabricated number. PASS/FAIL are
   * compression-only; CONFIGURATION_REQUIRED is never treated as failed.
   */
  private buildQualityManagementRows(p: ReportParams): ReportQualityManagementRow[] {
    const lineMap = this.buildMap(p.lines);
    interface Acc {
      lineName: string;
      productName: string;
      recorded: number;
      assessed: number;
      passed: number;
      failed: number;
      heights: number[];
      weights: number[];
      loads: number[];
      compressions: number[];
    }
    const map = new Map<string, Acc>();
    const keyOf = (q: QualityTest): string => `${q.lineId ?? ''}|${q.productId ?? q.productName ?? ''}`;

    p.qualityTests.forEach(q => {
      const key = keyOf(q);
      const acc = map.get(key) ?? {
        lineName: q.lineName ?? lineMap.get(q.lineId ?? '') ?? 'Not specified',
        productName: q.productName ?? 'Unattributed',
        recorded: 0, assessed: 0, passed: 0, failed: 0,
        heights: [], weights: [], loads: [], compressions: []
      };
      const samples = (q.samples || []).filter(s => !!s);
      if (samples.length > 0) {
        acc.recorded += samples.length;
        samples.forEach(s => {
          if (s.compressionResult === 'PASS')      { acc.assessed++; acc.passed++; }
          else if (s.compressionResult === 'FAIL') { acc.assessed++; acc.failed++; }
          if (Number.isFinite(s.actualHeight)) acc.heights.push(s.actualHeight);
          if (Number.isFinite(s.actualWeight)) acc.weights.push(s.actualWeight);
          if (Number.isFinite(s.load)) acc.loads.push(s.load);
          if (Number.isFinite(s.compression)) acc.compressions.push(s.compression);
        });
      } else {
        acc.recorded += 1;
        if (q.result === 'PASS')      { acc.assessed++; acc.passed++; }
        else if (q.result === 'FAIL') { acc.assessed++; acc.failed++; }
      }
      map.set(key, acc);
    });

    return Array.from(map.values())
      .map(acc => ({
        lineName: acc.lineName,
        productName: acc.productName,
        recorded: acc.recorded,
        assessed: acc.assessed,
        passed: acc.passed,
        failed: acc.failed,
        passRate: acc.assessed > 0 ? ((acc.passed / acc.assessed) * 100).toFixed(1) : '0.0',
        avgHeight: QualityCalculationUtil.average(acc.heights),
        avgWeight: QualityCalculationUtil.average(acc.weights),
        avgLoad: QualityCalculationUtil.average(acc.loads),
        avgCompression: QualityCalculationUtil.averageCompression(acc.compressions)
      }))
      .sort((a, b) => a.lineName.localeCompare(b.lineName) || a.productName.localeCompare(b.productName));
  }

  private buildQualityBody(p: ReportParams): string[][] {
    const lineMap = this.buildMap(p.lines);
    const rows: string[][] = [];

    p.qualityTests.forEach(q => {
      const lineName = q.lineName ?? lineMap.get(q.lineId ?? '') ?? 'Not specified';
      const samples = (q.samples && q.samples.length > 0) ? q.samples : [null];
      samples.forEach(s => {
        rows.push([
          q.date,
          q.productName ?? '',
          lineName,
          q.testDate,
          s ? `Sample ${s.sampleNumber}` : '–',
          s ? String(s.actualHeight) : '–',
          s ? (q.standardHeightSnapshot != null ? String(q.standardHeightSnapshot) : '–') : '–',
          s ? (s.heightDifference != null ? String(s.heightDifference) : '–') : '–',
          s ? String(s.actualWeight) : '–',
          s ? (q.standardWeightSnapshot != null ? String(q.standardWeightSnapshot) : '–') : '–',
          s ? (s.weightDifference != null ? String(s.weightDifference) : '–') : '–',
          s ? String(s.load) : (q.load != null ? String(q.load) : '–'),
          q.productAreaSnapshot != null ? String(q.productAreaSnapshot) : '–',
          s ? String(s.compression) : (q.compression != null ? String(q.compression) : (q.strength != null ? String(q.strength) : '–')),
          q.compressionStandardSnapshot != null ? String(q.compressionStandardSnapshot) : (q.standardStrength != null ? String(q.standardStrength) : '–'),
          s ? (s.compressionResult === 'PASS' ? 'PASS' : s.compressionResult === 'FAIL' ? 'FAIL' : s.compressionResult)
             : (q.result === 'PASS' ? 'PASS' : q.result === 'FAIL' ? 'FAIL' : (q.result || '–'))
        ]);
      });
      const avg = this.qualityAverageRow(q, lineName);
      if (avg) rows.push(avg);
    });

    return rows;
  }

  /**
   * Inline AVERAGE row for a three-sample event — averages the ACTUAL
   * height / weight / load / compression of the stored samples. AVERAGE rows
   * never carry PASS / FAIL verdicts (Result is blank) and are omitted when
   * any of the four values is missing/invalid.
   */
  private qualityAverageRow(q: QualityTest, lineName: string): string[] | null {
    const samples = (q.samples || []).filter(s => !!s);
    if (samples.length < 3) return null;
    const valid = (pick: (s: QualitySample) => number | undefined | null): number | null => {
      const all = samples.map(s => pick(s));
      if (all.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
      return QualityCalculationUtil.average(all as number[]) ?? null;
    };
    const fmtAvg = (v: number | null | undefined): string => v === null || v === undefined ? '—' : String(Number(v.toFixed(2)));
    const avgHeight = valid(s => s.actualHeight);
    const avgWeight = valid(s => s.actualWeight);
    const avgLoad = valid(s => s.load);
    if (avgHeight === null || avgWeight === null || avgLoad === null) return null;
    const avgCompression = QualityCalculationUtil.averageCompression(samples.map(s => s.compression));
    return [
      'AVERAGE', q.productName ?? '', lineName, q.testDate, '3 samples',
      fmtAvg(avgHeight), '—', '—',
      fmtAvg(avgWeight), '—', '—',
      fmtAvg(avgLoad),
      q.productAreaSnapshot != null ? String(q.productAreaSnapshot) : '—',
      fmtAvg(avgCompression),
      '—', '—'
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF: COMPLETE REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPdfComplete(doc: jsPDF, p: ReportParams): void {
    this.drawHeader(doc, 'Complete Report');
    let y = this.drawMetadata(doc, p, 'Complete', 40);

    const stats = this.computeStats(p);

    y = this.drawSummaryCards(doc, [
      { label: 'Total Production', value: this.fmtNum(stats.totalProduced), color: this.BRAND_DARK },
      { label: 'Total Mixes', value: this.fmtNum(stats.totalMixes), color: this.BRAND_GOLD },
      { label: 'Samples Recorded', value: String(stats.recorded), color: [63, 125, 90] },
      { label: 'Sample Pass Rate', value: `${stats.passRate}%`, color: [70, 130, 180] },
      { label: 'Total Cost', value: this.fmtCurrency(stats.totalCost), color: [180, 130, 50] },
      { label: 'Total Overtime', value: `${stats.totalOvertime}h`, color: [160, 82, 45] }
    ], y);

    // ── Section 1: Executive Summary ─────────────────────────────────────────
    y = this.drawSectionTitle(doc, 'Executive Summary', y);
    const summaryBody = [
      ['Total Production', this.fmtNum(stats.totalProduced), 'pieces'],
      ['Total Presses', this.fmtNum(stats.totalPresses), 'presses'],
      ['Total Mixes', this.fmtNum(stats.totalMixes), 'mixes'],
      ['Total Material Cost', this.fmtCurrency(stats.totalCost), ''],
      ['Samples Recorded', String(stats.recorded), 'samples'],
      ['Samples Assessed', String(stats.assessed), 'samples'],
      ['Sample Pass Rate', `${stats.passRate}%`, ''],
      ['Total Released Output', this.fmtNum(stats.totalReleased), 'pieces'],
      ['Total Overtime', `${stats.totalOvertime}`, 'hours'],
      ['Total Downtime', `${stats.totalDowntime}`, 'minutes'],
      ['Time Efficiency', `${stats.timeEfficiency}`, '']
    ];
    y = this.drawTable(doc, [['Metric', 'Value', 'Unit']], summaryBody, y);

    // ── Section 2: Production ────────────────────────────────────────────────
    doc.addPage();
    y = 25;
    y = this.drawSectionTitle(doc, 'Production', y);

    if (p.productions.length === 0) {
      y = this.drawNoData(doc, y);
    } else {
      const head = [['Date', 'Line', 'Product', 'Shift', 'Supervisor', 'PP', 'Press', 'Produced', 'OT(h)', 'DT(m)', 'DT Reason', 'Notes']];
      const body = this.buildProductionBody(p);
      y = this.drawTable(doc, head, body, y);

      y += 3;
      y = this.checkPageBreak(doc, y, 20, p);
      y = this.drawSectionTitle(doc, 'Released Output', y);
      const prodOutput = this.buildProductionOutput(p);
      y = this.drawTable(doc, [['Date', 'Line', 'Product', 'Presses', 'Press Production', 'Released Output']],
        prodOutput.map(po => [po.date, po.lineName, po.productName, this.fmtNum(po.presses), this.fmtNum(po.produced), this.fmtNum(po.releasedOutput)]), y);

      y += 3;
      y = this.checkPageBreak(doc, y, 20, p);
      y = this.drawSectionTitle(doc, 'Production Totals', y);
      y = this.drawTable(doc, [['Metric', 'Value']], [
        ['Total Presses', this.fmtNum(stats.totalPresses)],
        ['Total Produced', this.fmtNum(stats.totalProduced)],
        ['Total Released Output', this.fmtNum(stats.totalReleased)],
        ['Total Overtime', `${stats.totalOvertime} hrs`],
        ['Total Downtime', `${stats.totalDowntime} min`]
      ], y);
    }

    // ── Section 3: Materials ─────────────────────────────────────────────────
    doc.addPage();
    y = 25;
    y = this.drawSectionTitle(doc, 'Materials', y);

    if (p.materials.length === 0) {
      y = this.drawNoData(doc, y);
    } else {
      const head = [['Date', 'Line', 'Product', 'Mixes', 'Material', 'Unit', 'Theoretical', 'Actual', 'Variance', 'Unit Cost', 'Total Cost']];
      const body = this.buildMaterialsBody(p);
      y = this.drawTable(doc, head, body, y);

      y += 3;
      y = this.checkPageBreak(doc, y, 16, p);
      y = this.drawTable(doc, [['Metric', 'Value']], [
        ['Total Records', String(p.materials.length)],
        ['Total Mixes', this.fmtNum(stats.totalMixes)],
        ['Grand Total Cost', this.fmtCurrency(stats.totalCost)]
      ], y);
    }

    // ── Section 4: Quality (Management Summary) ───────────────────────────────
    // The Complete report presents a concise management view (portrait) instead
    // of repeating the detailed 16-col quality table — the dedicated Quality
    // report keeps the full detail on its landscape pages.
    doc.addPage('a4', 'portrait');
    y = 25;
    y = this.drawSectionTitle(doc, 'Quality', y);

    if (p.qualityTests.length === 0) {
      y = this.drawNoData(doc, y);
    } else {
      const mgmt = this.buildQualityManagementRows(p);
      y = this.drawTable(doc,
        [['Line', 'Product', 'Recorded', 'Assessed', 'Avg Height', 'Avg Weight (kg)', 'Avg Load (kN)', 'Avg Compression', 'Passed', 'Failed', 'Pass Rate']],
        mgmt.map(m => [
          m.lineName, m.productName,
          String(m.recorded), String(m.assessed),
          m.avgHeight != null ? String(m.avgHeight) : '—',
          m.avgWeight != null ? String(m.avgWeight) : '—',
          m.avgLoad != null ? String(m.avgLoad) : '—',
          m.avgCompression != null ? String(m.avgCompression) : '—',
          String(m.passed), String(m.failed),
          `${m.passRate}%`
        ]), y);

      y += 3;
      y = this.checkPageBreak(doc, y, 24, p);
      y = this.drawSectionTitle(doc, 'Quality Summary', y);
      y = this.drawQualityMetricsTable(doc, {
        recorded: stats.recorded, assessed: stats.assessed,
        passed: stats.passed, failed: stats.failed, passRate: stats.passRate
      }, y);
    }

    // ── Section 5: Performance Summary ───────────────────────────────────────
    doc.addPage('a4', 'portrait');
    y = 25;
    y = this.drawSectionTitle(doc, 'Performance Summary', y);

    const breakdown = this.buildProductBreakdown(p);
    if (breakdown.length > 0) {
      y = this.drawTable(doc, [['Product', 'Presses', 'Press Production', 'Released Output']],
        breakdown.map(b => [b.productName, this.fmtNum(b.presses), this.fmtNum(b.produced), this.fmtNum(b.releasedOutput)]), y);
    } else {
      y = this.drawNoData(doc, y);
    }

    y += 5;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Overall KPIs', y);
    y = this.drawTable(doc, [['KPI', 'Value']], this.buildOverallKpiRows(stats), y);
  }

  /**
   * Complete report Overall KPIs. Press output is explicitly labeled as Output
   * per Press (pieces / presses) — it is operational throughput, NOT an
   * operational efficiency figure. Time Efficiency lives in the Executive
   * Summary as a weighted SUM(run)/SUM(available) ratio.
   */
  private buildOverallKpiRows(stats: {
    totalPresses: number; totalProduced: number; totalCost: number;
    totalOvertime: number; totalDowntime: number;
    passRate: string; passed: number; assessed: number;
  }): string[][] {
    return [
      ['Output per Press', stats.totalPresses > 0 ? `${this.fmtNum(stats.totalProduced)} pieces / ${this.fmtNum(stats.totalPresses)} presses` : 'No data'],
      ['Quality Performance', `${stats.passRate}% sample pass rate (${stats.passed}/${stats.assessed} assessed samples passed)`],
      ['Material Cost', this.fmtCurrency(stats.totalCost)],
      ['Operational Time', `${stats.totalOvertime}h overtime, ${stats.totalDowntime}m downtime`]
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF: DAILY / MONTHLY OPERATIONAL REPORTS (landscape)
  // ═══════════════════════════════════════════════════════════════════════════

  private fmtM3(v: number | typeof CONFIGURATION_REQUIRED): string {
    return typeof v === 'number' ? v.toFixed(2) : v;
  }

  private hasOperationalData(p: ReportParams): boolean {
    return p.productions.length > 0 || p.releases.length > 0 || p.materials.length > 0 || p.qualityTests.length > 0;
  }

  private drawLineOpsTable(doc: jsPDF, lines: ReportLineOpsRow[], y: number): number {
    return this.drawTable(doc, [['Line', 'Pressed Product(s)', 'Released Product(s)', 'Shift', 'Presses', 'Produced', 'Released', 'Mix', 'Cement (kg)', 'Sand (m³)', 'Agg. (m³)', 'Water (L)', 'DT (min)', 'Avail (min)', 'Run (min)', 'Time Eff (%)', 'Samples', 'Passed', 'Failed']],
      lines.map(l => [
        l.lineName, l.pressedProductsLabel, l.releasedProductsLabel, l.shiftsLabel,
        this.fmtNum(l.presses), this.fmtNum(l.produced), this.fmtNum(l.releasedOutput), this.fmtNum(l.mixCount),
        this.fmtNum(l.cementKg), this.fmtM3(l.sandM3), this.fmtM3(l.aggregateM3), this.fmtNum(l.waterL),
        this.fmtNum(l.downtimeMinutes), this.fmtNum(l.availableMinutes), this.fmtNum(l.actualRunMinutes),
        `${l.timeEfficiency.toFixed(1)}%`, String(l.samples), String(l.passed), String(l.failed)
      ]), y);
  }

  private drawQualityMetricsTable(doc: jsPDF, q: { recorded: number; assessed: number; passed: number; failed: number; passRate: string }, y: number): number {
    return this.drawTable(doc, [['Metric', 'Value']], [
      ['Samples Recorded', String(q.recorded)],
      ['Samples Assessed', String(q.assessed)],
      ['Samples Passed', String(q.passed)],
      ['Samples Failed', String(q.failed)],
      ['Samples Pending Configuration', String(q.recorded - q.assessed)],
      ['Sample Pass Rate', `${q.passRate}%`]
    ], y);
  }

  private buildPdfDaily(doc: jsPDF, p: ReportParams): void {
    this.drawHeader(doc, 'Daily Operational Report');
    const kpis = this.buildOperationKpis(p);
    const breakdown = this.buildProductBreakdown(p);
    const prodOutput = this.buildProductionOutput(p);
    const lines = this.buildLineOperations(p);
    const materials = this.buildMaterialUsageRows(p);
    const q = this.qualityStats(p.qualityTests);

    let y = this.drawMetadata(doc, p, 'Daily', 40);
    y = this.drawSummaryCards(doc, [
      { label: 'Press Production', value: this.fmtNum(kpis.produced), color: this.BRAND_DARK },
      { label: 'Total Presses', value: this.fmtNum(kpis.presses), color: this.BRAND_GOLD },
      { label: 'Released Output', value: this.fmtNum(kpis.released), color: [63, 125, 90] },
      { label: 'Total Mixes', value: this.fmtNum(kpis.mixes), color: [70, 130, 180] },
      { label: 'Time Efficiency', value: `${kpis.timeEfficiency.toFixed(1)}%`, color: [180, 130, 50] },
      { label: 'Sample Pass Rate', value: `${q.passRate}%`, color: [160, 82, 45] }
    ], y);

    if (!this.hasOperationalData(p)) {
      y = this.drawNoData(doc, y);
      return;
    }

    y = this.drawSectionTitle(doc, 'Product Breakdown', y);
    y = this.drawTable(doc, [['Product', 'Presses', 'Press Production', 'Released Output']],
      breakdown.map(b => [b.productName, this.fmtNum(b.presses), this.fmtNum(b.produced), this.fmtNum(b.releasedOutput)]), y);

    y += 3;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Production + Output', y);
    y = this.drawTable(doc, [['Date', 'Line', 'Product', 'Presses', 'Press Production', 'Released Output']],
      prodOutput.map(po => [po.date, po.lineName, po.productName, this.fmtNum(po.presses), this.fmtNum(po.produced), this.fmtNum(po.releasedOutput)]), y);

    y += 3;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Line-Level Operations', y);
    y = this.drawLineOpsTable(doc, lines, y);

    y += 3;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Materials by Record', y);
    y = this.drawTable(doc, [['Date', 'Line', 'Mix', 'Cement (kg)', 'Sand (kg)', 'Sand (m³)', 'Agg. (kg)', 'Agg. (m³)', 'Water (L)']],
      materials.map(m => [m.date, m.lineName, this.fmtNum(m.mixCount), this.fmtNum(m.cementKg), this.fmtNum(m.sandKg), this.fmtM3(m.sandM3), this.fmtNum(m.aggregateKg), this.fmtM3(m.aggregateM3), this.fmtNum(m.waterL)]), y);

    y += 3;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Quality Summary', y);
    y = this.drawQualityMetricsTable(doc, q, y);
  }

  private buildPdfMonthly(doc: jsPDF, p: ReportParams): void {
    this.drawHeader(doc, 'Monthly Operational Report');
    const kpis = this.buildOperationKpis(p);
    const breakdown = this.buildProductBreakdown(p);
    const lines = this.buildLineOperations(p);
    const materials = this.buildLineMaterialRows(p);
    const q = this.qualityStats(p.qualityTests);

    let y = this.drawMetadata(doc, p, 'Monthly', 40);
    y = this.drawSummaryCards(doc, [
      { label: 'Total Produced', value: this.fmtNum(kpis.produced), color: this.BRAND_DARK },
      { label: 'Total Presses', value: this.fmtNum(kpis.presses), color: this.BRAND_GOLD },
      { label: 'Released Output', value: this.fmtNum(kpis.released), color: [63, 125, 90] },
      { label: 'Total Mixes', value: this.fmtNum(kpis.mixes), color: [70, 130, 180] },
      { label: 'Time Efficiency', value: `${kpis.timeEfficiency.toFixed(1)}%`, color: [180, 130, 50] },
      { label: 'Sample Pass Rate', value: `${q.passRate}%`, color: [160, 82, 45] }
    ], y);

    if (!this.hasOperationalData(p)) {
      y = this.drawNoData(doc, y);
      return;
    }

    y = this.drawSectionTitle(doc, 'Monthly Production + Output by Product', y);
    y = this.drawTable(doc, [['Product', 'Total Presses', 'Total Produced', 'Total Released']],
      breakdown.map(b => [b.productName, this.fmtNum(b.presses), this.fmtNum(b.produced), this.fmtNum(b.releasedOutput)]), y);

    y += 3;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Monthly Line Summary', y);
    y = this.drawLineOpsTable(doc, lines, y);

    y += 3;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Monthly Materials by Line', y);
    y = this.drawTable(doc, [['Line', 'Mix', 'Cement (kg)', 'Sand (kg)', 'Sand (m³)', 'Agg. (kg)', 'Agg. (m³)', 'Water (L)']],
      materials.map(m => [m.lineName, this.fmtNum(m.mixCount), this.fmtNum(m.cementKg), this.fmtNum(m.sandKg), this.fmtM3(m.sandM3), this.fmtNum(m.aggregateKg), this.fmtM3(m.aggregateM3), this.fmtNum(m.waterL)]), y);

    y += 3;
    y = this.checkPageBreak(doc, y, 20, p);
    y = this.drawSectionTitle(doc, 'Monthly Quality Summary', y);
    y = this.drawQualityMetricsTable(doc, q, y);
  }

  // ─── No Data Message ───────────────────────────────────────────────────────

  private drawNoData(doc: jsPDF, y: number): number {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...this.TEXT_LIGHT);
    doc.text('No data available for this report type in the selected date range.', pageW / 2, y + 5, { align: 'center' });
    return y + 15;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private buildMap<T extends { id: string; name: string }>(items: T[]): Map<string, string> {
    return new Map(items.map(item => [item.id, item.name]));
  }

  private buildSessionMap(sessions: ProductionSession[]): Map<string, ProductionSession> {
    const map = new Map<string, ProductionSession>();
    sessions.forEach(s => {
      map.set(s.id, s);
      map.set(`${s.date}_${s.shiftId}_${s.lineId}`, s);
    });
    return map;
  }

  private findSession(prod: Production, sessionMap: Map<string, ProductionSession>): ProductionSession | undefined {
    if (prod.sessionId) {
      const byId = sessionMap.get(prod.sessionId);
      if (byId) return byId;
    }
    return sessionMap.get(`${prod.date}_${prod.shiftId}_${prod.lineId}`);
  }

  private computeStats(p: ReportParams): {
    totalPresses: number; totalProduced: number; totalReleased: number;
    totalOvertime: number; totalDowntime: number; totalMixes: number;
    totalCost: number; totalSamples: number; recorded: number; assessed: number;
    passed: number; failed: number; passRate: string;
    timeEfficiency: string;
  } {
    let totalPresses = 0, totalProduced = 0;
    p.productions.forEach(prod => {
      totalPresses += prod.presses || 0;
      totalProduced += prod.produced || 0;
    });

    // Released Output is an independent Output-Release aggregate — never
    // production.releasedOutput. Time comes from the authoritative 390/day/line
    // aggregation (never × products/sessions/records/lines). Total cost excludes
    // demo (business-unverified) unit-costs.
    const totalReleased = p.releases.reduce((s, r) => s + (r.releasedQuantity || 0), 0);
    const time = this.timeAggregate(p);
    const totalOvertime = time.totalOvertimeHours;
    const totalDowntime = time.totalDowntimeMinutes;

    const totalMixes = p.materials.reduce((s, m) => s + (m.mixCount || 0), 0);
    const totalCost = p.materials.reduce((s, m) => s + this.effectiveRecordCost(p, m), 0);
    const qStats = this.qualityStats(p.qualityTests);
    const totalSamples = qStats.recorded;
    const recorded = qStats.recorded;
    const assessed = qStats.assessed;
    const passed = qStats.passed;
    const failed = qStats.failed;
    const passRate = qStats.passRate;

    const timeEfficiency = time.timeEfficiency;

    return { totalPresses, totalProduced, totalReleased, totalOvertime, totalDowntime, totalMixes, totalCost, totalSamples, recorded, assessed, passed, failed, passRate, timeEfficiency };
  }

  private countUnique<T>(items: T[], key: keyof T): number {
    return new Set(items.map(i => i[key])).size;
  }

  private fmtDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private fmtNum(n: number): string {
    return n.toLocaleString('en-US');
  }

  private fmtCurrency(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private buildFilename(p: ReportParams, ext: string): string {
    const type = p.type.charAt(0).toUpperCase() + p.type.slice(1);
    const today = p.range.endDate;
    return p.range.startDate === p.range.endDate
      ? `TPMS_${type}_Report_${today}.${ext}`
      : `TPMS_${type}_Report_${p.range.startDate}_to_${p.range.endDate}.${ext}`;
  }
}
