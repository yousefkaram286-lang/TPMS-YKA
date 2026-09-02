import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'products';

  // Helper: DB snake_case → frontend camelCase
  private mapToModel(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      nameAr: row.name_ar !== null ? row.name_ar : undefined,
      type: row.type !== null ? row.type : undefined,
      piecesPerPress: row.pieces_per_press !== null ? row.pieces_per_press : undefined,
      productArea: row.product_area !== null ? row.product_area : undefined,
      standardStrength: row.standard_strength,
      standardHeight: row.standard_height !== null ? row.standard_height : undefined,
      standardWeight: row.standard_weight !== null ? row.standard_weight : undefined,
      dimensions: row.dimensions !== null ? row.dimensions : undefined,
      densityKgPerM3: row.density_kg_per_m3 !== null ? row.density_kg_per_m3 : undefined,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper: frontend camelCase → DB snake_case
  private mapToDb(product: Product): any {
    return {
      id: product.id,
      name: product.name,
      name_ar: product.nameAr ?? null,
      type: product.type ?? null,
      pieces_per_press: product.piecesPerPress ?? null,
      product_area: product.productArea ?? null,
      standard_strength: product.standardStrength,
      standard_height: product.standardHeight ?? null,
      standard_weight: product.standardWeight ?? null,
      dimensions: product.dimensions ?? null,
      density_kg_per_m3: product.densityKgPerM3 ?? null,
      active: product.active,
      created_at: product.createdAt,
      updated_at: product.updatedAt ?? null
    };
  }

  getAll(): Observable<Product[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  getById(id: string): Observable<Product | undefined> {
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

  create(product: Product): Observable<Product> {
    const dbRecord = this.mapToDb(product);
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

  update(product: Product): Observable<Product> {
    const dbRecord = this.mapToDb(product);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', product.id)
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
