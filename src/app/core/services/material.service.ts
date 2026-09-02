import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Material } from '../models/material.model';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'materials';

  // Helper: DB snake_case → frontend camelCase
  private mapToModel(row: any): Material {
    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      conversionKgPerM3: row.conversion_kg_per_m3 !== null ? row.conversion_kg_per_m3 : undefined,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper: frontend camelCase → DB snake_case
  private mapToDb(material: Material): any {
    return {
      id: material.id,
      name: material.name,
      unit: material.unit,
      conversion_kg_per_m3: material.conversionKgPerM3 ?? null,
      active: material.active,
      created_at: material.createdAt,
      updated_at: material.updatedAt ?? null
    };
  }

  getAll(): Observable<Material[]> {
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

  getById(id: string): Observable<Material | undefined> {
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

  create(material: Material): Observable<Material> {
    const dbRecord = this.mapToDb(material);
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

  update(material: Material): Observable<Material> {
    const dbRecord = this.mapToDb(material);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', material.id)
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
