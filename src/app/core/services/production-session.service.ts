import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ProductionSession, DailyLineTimeEntry } from '../models/production-session.model';

@Injectable({
  providedIn: 'root'
})
export class ProductionSessionService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'production_sessions';

  // Helper to map DB snake_case to frontend camelCase
  private mapToModel(row: any): ProductionSession {
    return {
      id: row.id,
      date: row.date,
      shiftId: row.shift_id,
      lineId: row.line_id,
      supervisor: row.supervisor,
      releasedOutput: row.released_output !== null ? row.released_output : undefined,
      overtime: row.overtime,
      overtimeHours: row.overtime_hours,
      dailyLineTime: (row.daily_line_time || []).map((lt: any) => ({
        lineId: lt.lineId,
        lineName: lt.lineName,
        overtimeHours: lt.overtimeHours,
        downtimeMinutes: lt.downtimeMinutes,
        downtimeReason: lt.downtimeReason,
        notes: lt.notes
      })),
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper to map frontend camelCase to DB snake_case
  private mapToDb(session: ProductionSession): any {
    return {
      id: session.id,
      date: session.date,
      shift_id: session.shiftId,
      line_id: session.lineId,
      supervisor: session.supervisor,
      released_output: session.releasedOutput ?? null,
      overtime: session.overtime,
      overtime_hours: session.overtimeHours,
      daily_line_time: session.dailyLineTime, // JSONB structure stays the same for easy parsing
      notes: session.notes,
      created_at: session.createdAt,
      updated_at: session.updatedAt ?? null
    };
  }

  getAll(): Observable<ProductionSession[]> {
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

  getById(id: string): Observable<ProductionSession | undefined> {
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

  create(session: ProductionSession): Observable<ProductionSession> {
    const dbRecord = this.mapToDb(session);
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

  update(session: ProductionSession): Observable<ProductionSession> {
    const dbRecord = this.mapToDb(session);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', session.id)
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
