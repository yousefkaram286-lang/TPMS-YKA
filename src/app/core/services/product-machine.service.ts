import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ProductMachineConfig } from '../models/product-machine.model';

@Injectable({
  providedIn: 'root'
})
export class ProductMachineService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'product_machine_configs';

  // Helper: DB snake_case → frontend camelCase
  private mapToModel(row: any): ProductMachineConfig {
    return {
      id: row.id,
      productId: row.product_id,
      machineId: row.machine_id,
      piecesPerPress: row.pieces_per_press,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper: frontend camelCase → DB snake_case
  private mapToDb(config: ProductMachineConfig): any {
    return {
      id: config.id,
      product_id: config.productId,
      machine_id: config.machineId,
      pieces_per_press: config.piecesPerPress,
      created_at: config.createdAt,
      updated_at: config.updatedAt ?? null
    };
  }

  getAll(): Observable<ProductMachineConfig[]> {
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

  getById(id: string): Observable<ProductMachineConfig | undefined> {
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

  create(config: ProductMachineConfig): Observable<ProductMachineConfig> {
    const dbRecord = this.mapToDb(config);
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

  update(config: ProductMachineConfig): Observable<ProductMachineConfig> {
    const dbRecord = this.mapToDb(config);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', config.id)
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
