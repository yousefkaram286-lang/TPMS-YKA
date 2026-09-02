import { Injectable, inject } from '@angular/core';
import { Observable, of, from, throwError, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ProductService } from './product.service';
import { LineService } from './line.service';
import { QualityTest } from '../models/quality-test.model';
import { QualityCalculationUtil } from '../utils/quality-calculation.util';
import { MasterDataUtil } from '../utils/master-data.util';

@Injectable({
  providedIn: 'root'
})
export class QualityService {
  private supabaseService = inject(SupabaseService);
  private productService = inject(ProductService);
  private lineService = inject(LineService);
  private tableName = 'quality_tests';

  // Helper to map DB snake_case to frontend camelCase
  private mapToModel(row: any): QualityTest {
    return {
      id: row.id,
      date: row.date,
      productId: row.product_id,
      productName: row.product_name,
      lineId: row.line_id !== null ? row.line_id : undefined,
      lineName: row.line_name !== null ? row.line_name : undefined,
      testDate: row.test_date,
      productAreaSnapshot: row.product_area_snapshot !== null ? row.product_area_snapshot : undefined,
      compressionStandardSnapshot: row.compression_standard_snapshot !== null ? row.compression_standard_snapshot : undefined,
      standardHeightSnapshot: row.standard_height_snapshot !== null ? row.standard_height_snapshot : undefined,
      standardWeightSnapshot: row.standard_weight_snapshot !== null ? row.standard_weight_snapshot : undefined,
      productionRecordId: row.production_record_id !== null ? row.production_record_id : undefined,
      productionDate: row.production_date !== null ? row.production_date : undefined,
      notes: row.notes !== null ? row.notes : undefined,
      submissionId: row.submission_id !== null ? row.submission_id : undefined,
      samples: row.samples !== null ? row.samples : undefined,
      strength: row.strength !== null ? row.strength : undefined,
      standardStrength: row.standard_strength !== null ? row.standard_strength : undefined,
      load: row.load !== null ? row.load : undefined,
      compression: row.compression !== null ? row.compression : undefined,
      sample: row.sample !== null ? row.sample : undefined,
      result: row.result !== null ? row.result : undefined,
      decisionSource: row.decision_source !== null ? row.decision_source : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper to map frontend camelCase to DB snake_case
  private mapToDb(record: QualityTest): any {
    return {
      id: record.id,
      date: record.date,
      product_id: record.productId,
      product_name: record.productName,
      line_id: record.lineId ?? null,
      line_name: record.lineName ?? null,
      test_date: record.testDate,
      product_area_snapshot: record.productAreaSnapshot ?? null,
      compression_standard_snapshot: record.compressionStandardSnapshot ?? null,
      standard_height_snapshot: record.standardHeightSnapshot ?? null,
      standard_weight_snapshot: record.standardWeightSnapshot ?? null,
      production_record_id: record.productionRecordId ?? null,
      production_date: record.productionDate ?? null,
      notes: record.notes ?? null,
      submission_id: record.submissionId ?? null,
      samples: record.samples ?? null,
      strength: record.strength ?? null,
      standard_strength: record.standardStrength ?? null,
      load: record.load ?? null,
      compression: record.compression ?? null,
      sample: record.sample ?? null,
      result: record.result ?? null,
      decision_source: record.decisionSource ?? null,
      created_at: record.createdAt,
      updated_at: record.updatedAt ?? null
    };
  }

  getAll(): Observable<QualityTest[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .order('test_date', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  getById(id: string): Observable<QualityTest | undefined> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          if (error.code === 'PGRST116') return undefined; // Record not found
          throw error;
        }
        return data ? this.mapToModel(data) : undefined;
      }),
      catchError(err => throwError(() => err))
    );
  }

  create(record: QualityTest): Observable<QualityTest> {
    const dbRecord = this.mapToDb(record);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .insert(dbRecord)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapToModel(data);
      }),
      catchError(err => throwError(() => err))
    );
  }

  update(record: QualityTest): Observable<QualityTest> {
    const dbRecord = this.mapToDb(record);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', record.id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapToModel(data);
      }),
      catchError(err => throwError(() => err))
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError(err => throwError(() => err))
    );
  }

  createIdempotent(record: QualityTest): Observable<QualityTest> {
    if (!record.id) {
      return throwError(() => new Error('Submission id is required'));
    }

    return this.getById(record.id).pipe(
      switchMap(existing => {
        if (existing) {
          return of(existing);
        }

        const requiredError = this.validateRequiredFields(record);
        if (requiredError) {
          return throwError(() => requiredError);
        }

        return this.validateMasterReferences(record).pipe(
          switchMap(() => this.create(record)),
          catchError(err => {
            if (err?.code === '23505' || err?.message?.includes('duplicate key value') || err?.message?.includes('Key already exists')) {
              return this.getById(record.id).pipe(
                map(existing => {
                   if (!existing) throw new Error('Duplicate key violation but record not found on fetch');
                   return existing;
                })
              );
            }
            return throwError(() => err);
          })
        );
      }),
      catchError(err => {
        if (err?.code === '23505' || err?.message?.includes('duplicate key value') || err?.message?.includes('Key already exists')) {
          return this.getById(record.id).pipe(
            map(existing => {
               if (!existing) throw new Error('Duplicate key violation but record not found on fetch');
               return existing;
            })
          );
        }
        return throwError(() => err);
      })
    );
  }

  private validateRequiredFields(record: QualityTest): Error | null {
    if (!record.testDate) {
      return new Error('Test Date is required');
    }
    if (!record.lineId) {
      return new Error('Line is required');
    }
    if (!record.productId) {
      return new Error('Product is required');
    }
    if (!record.samples || record.samples.length !== 3) {
      return new Error('Exactly 3 samples are required');
    }
    for (let i = 0; i < record.samples.length; i++) {
      const sample = record.samples[i];
      const label = `Sample ${sample.sampleNumber || i + 1}`;
      if (!Number.isFinite(sample.actualHeight) || !(sample.actualHeight > 0)) {
        return new Error(`${label} Actual Height must be greater than zero`);
      }
      if (!Number.isFinite(sample.actualWeight) || !(sample.actualWeight > 0)) {
        return new Error(`${label} Actual Weight must be greater than zero`);
      }
      if (!Number.isFinite(sample.load) || !(sample.load > 0)) {
        return new Error(`${label} Load must be greater than zero`);
      }
      if (!Number.isFinite(sample.compression) || sample.compressionResult !== 'PASS' && sample.compressionResult !== 'FAIL') {
        return new Error(`${label} Compression result could not be calculated`);
      }
    }
    if (!MasterDataUtil.isConfiguredPositive(record.productAreaSnapshot)) {
      return new Error('Product Area is not configured for this product — Compression cannot be calculated');
    }
    if (!MasterDataUtil.isConfiguredPositive(record.compressionStandardSnapshot)) {
      return new Error('Compression Standard is not configured for this product');
    }
    return null;
  }

  private validateMasterReferences(record: QualityTest): Observable<void> {
    const lineId = record.lineId as string;
    const productId = record.productId as string;
    const checks: Observable<unknown>[] = [
      this.lineService.getById(lineId).pipe(map(l => {
        if (!l) throw new Error(`Line not found: ${lineId}`);
      })),
      this.productService.getById(productId).pipe(map(p => {
        if (!p) throw new Error(`Product not found: ${productId}`);
      }))
    ];

    return forkJoin(checks).pipe(map(() => void 0));
  }

  calculateCompression(load: number, productArea: number | undefined | null): number | undefined {
    return QualityCalculationUtil.calculateCompression(load, productArea);
  }
}