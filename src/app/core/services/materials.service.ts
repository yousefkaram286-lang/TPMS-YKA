import { Injectable, inject } from '@angular/core';
import { Observable, of, from, throwError, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ProductService } from './product.service';
import { LineService } from './line.service';
import { ShiftService } from './shift.service';
import { MaterialService } from './material.service';
import { MaterialRecord, MaterialTransactionItem } from '../models/material-record.model';

@Injectable({
  providedIn: 'root'
})
export class MaterialsService {
  private supabaseService = inject(SupabaseService);
  private productService = inject(ProductService);
  private lineService    = inject(LineService);
  private shiftService   = inject(ShiftService);
  private materialService = inject(MaterialService);
  private tableName = 'material_records';

  // Helper to map DB snake_case to frontend camelCase
  private mapToModel(row: any): MaterialRecord {
    return {
      id: row.id,
      date: row.date,
      lineId: row.line_id,
      shiftId: row.shift_id !== null ? row.shift_id : undefined,
      productId: row.product_id !== null ? row.product_id : undefined,
      mixCount: row.mix_count,
      materials: row.materials || [],
      totalCost: row.total_cost,
      operator: row.operator !== null ? row.operator : undefined,
      notes: row.notes !== null ? row.notes : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper to map frontend camelCase to DB snake_case
  private mapToDb(record: MaterialRecord): any {
    return {
      id: record.id,
      date: record.date,
      line_id: record.lineId,
      shift_id: record.shiftId ?? null,
      product_id: record.productId ?? null,
      mix_count: record.mixCount,
      materials: record.materials, // JSONB structure stays the same
      total_cost: record.totalCost,
      operator: record.operator ?? null,
      notes: record.notes ?? null,
      created_at: record.createdAt,
      updated_at: record.updatedAt ?? null
    };
  }

  getAll(): Observable<MaterialRecord[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .order('date', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  getById(id: string): Observable<MaterialRecord | undefined> {
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

  create(record: MaterialRecord): Observable<MaterialRecord> {
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

  update(record: MaterialRecord): Observable<MaterialRecord> {
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

  createIdempotent(record: MaterialRecord): Observable<MaterialRecord> {
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
            // Unique violation (23505) means concurrent race
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

  calculateDailyTotal(perMixActual: number, mixCount: number): number {
    return perMixActual * mixCount;
  }

  calculateTheoretical(perMixStandard: number, mixCount: number): number {
    return perMixStandard * mixCount;
  }

  calculateVariance(actual: number, theoretical: number): number {
    return actual - theoretical;
  }

  calculateTotalCost(materialCosts: number[]): number {
    return materialCosts.reduce((sum, cost) => sum + (cost || 0), 0);
  }

  calculateMaterialCost(actual: number, unitCost: number): number {
    return actual * unitCost;
  }

  private validateRequiredFields(record: MaterialRecord): Error | null {
    if (!record.date) {
      return new Error('Date is required');
    }
    if (!record.lineId) {
      return new Error('Line is required');
    }
    if (record.mixCount == null || !(record.mixCount > 0)) {
      return new Error('Mix count must be greater than zero');
    }
    if (!record.materials || record.materials.length === 0) {
      return new Error('At least one material item is required');
    }

    for (let i = 0; i < record.materials.length; i++) {
      const item = record.materials[i];
      if (!item.materialName || !item.materialName.trim()) {
        return new Error(`Material name is required on item ${i + 1}`);
      }
      if (item.perMixActual == null) {
        return new Error(`Actual per mix is required for ${item.materialName || item.materialId}`);
      }
      if (item.perMixActual < 0) {
        return new Error(`Actual per mix cannot be negative for ${item.materialName || item.materialId}`);
      }
    }
    return null;
  }

  private validateMasterReferences(record: MaterialRecord): Observable<void> {
    const checks: Observable<unknown>[] = [
      this.lineService.getById(record.lineId).pipe(map(l => {
        if (!l) throw new Error(`Line not found: ${record.lineId}`);
      }))
    ];

    if (record.shiftId) {
      checks.push(this.shiftService.getById(record.shiftId).pipe(map(s => {
        if (!s) throw new Error(`Shift not found: ${record.shiftId}`);
      })));
    }

    if (record.productId) {
      checks.push(this.productService.getById(record.productId).pipe(map(p => {
        if (!p) throw new Error(`Product not found: ${record.productId}`);
      })));
    }

    record.materials.forEach(item => {
      if (item.materialId) {
        checks.push(this.materialService.getById(item.materialId).pipe(map(m => {
          if (!m) throw new Error(`Material not found: ${item.materialId}`);
        })));
      }
    });

    return forkJoin(checks).pipe(map(() => void 0));
  }
}