import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { UnitCost } from '../models/unit-cost.model';

@Injectable({
  providedIn: 'root'
})
export class UnitCostService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'unit_costs';

  // Helper: DB snake_case → frontend camelCase
  private mapToModel(row: any): UnitCost {
    return {
      id: row.id,
      materialId: row.material_id,
      unitCost: row.unit_cost,
      unit: row.unit,
      demo: row.demo,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper: frontend camelCase → DB snake_case
  private mapToDb(cost: UnitCost): any {
    return {
      id: cost.id,
      material_id: cost.materialId,
      unit_cost: cost.unitCost,
      unit: cost.unit,
      demo: cost.demo,
      created_at: cost.createdAt,
      updated_at: cost.updatedAt ?? null
    };
  }

  getAll(): Observable<UnitCost[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  getById(id: string): Observable<UnitCost | undefined> {
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

  getByMaterialId(materialId: string): Observable<UnitCost | undefined> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('material_id', materialId)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data ? this.mapToModel(data) : undefined;
      }),
      catchError(err => throwError(() => err))
    );
  }

  create(unitCost: UnitCost): Observable<UnitCost> {
    const dbRecord = this.mapToDb(unitCost);
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

  update(unitCost: UnitCost): Observable<UnitCost> {
    const dbRecord = this.mapToDb(unitCost);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', unitCost.id)
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
}
