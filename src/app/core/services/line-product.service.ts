import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { LineProductMapping } from '../models/line-product.model';

@Injectable({
  providedIn: 'root'
})
export class LineProductService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'line_products';

  // Helper: DB snake_case → frontend camelCase
  private mapToModel(row: any): LineProductMapping {
    return {
      id: row.id,
      lineId: row.line_id,
      productId: row.product_id,
      createdAt: row.created_at
    };
  }

  // Helper: frontend camelCase → DB snake_case
  private mapToDb(mapping: LineProductMapping): any {
    return {
      id: mapping.id,
      line_id: mapping.lineId,
      product_id: mapping.productId,
      created_at: mapping.createdAt
    };
  }

  getAll(): Observable<LineProductMapping[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .order('line_id', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  getById(id: string): Observable<LineProductMapping | undefined> {
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

  create(mapping: LineProductMapping): Observable<LineProductMapping> {
    const dbRecord = this.mapToDb(mapping);
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