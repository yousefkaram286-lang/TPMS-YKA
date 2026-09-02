import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Line } from '../models/line.model';

@Injectable({
  providedIn: 'root'
})
export class LineService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'lines';

  // Helper: DB snake_case → frontend camelCase
  private mapToModel(row: any): Line {
    return {
      id: row.id,
      name: row.name,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper: frontend camelCase → DB snake_case
  private mapToDb(line: Line): any {
    return {
      id: line.id,
      name: line.name,
      active: line.active,
      created_at: line.createdAt,
      updated_at: line.updatedAt ?? null
    };
  }

  getAll(): Observable<Line[]> {
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

  getById(id: string): Observable<Line | undefined> {
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

  create(line: Line): Observable<Line> {
    const dbRecord = this.mapToDb(line);
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

  update(line: Line): Observable<Line> {
    const dbRecord = this.mapToDb(line);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', line.id)
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
