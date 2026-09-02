import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Production } from '../models/production.model';
import { ProductionUtil } from '../utils/production.util';

export interface ProductionRecordInput {
  id: string;
  sessionId?: string;
  date: string;
  shiftId?: string;
  lineId: string;
  productId: string;
  supervisor?: string;
  piecesPerPress: number | undefined;
  presses: number;
  machineId?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductionService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'productions';

  // Helper to map DB snake_case to frontend camelCase
  private mapToModel(row: any): Production {
    return {
      id: row.id,
      sessionId: row.session_id !== null ? row.session_id : undefined,
      date: row.date,
      shiftId: row.shift_id,
      lineId: row.line_id,
      machineId: row.machine_id !== null ? row.machine_id : undefined,
      supervisor: row.supervisor,
      productId: row.product_id,
      piecesPerPress: row.pieces_per_press,
      presses: row.presses,
      produced: row.produced,
      releasedOutput: row.released_output !== null ? row.released_output : undefined,
      output: row.output !== null ? row.output : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper to map frontend camelCase to DB snake_case
  private mapToDb(production: Production): any {
    return {
      id: production.id,
      session_id: production.sessionId ?? null,
      date: production.date,
      shift_id: production.shiftId,
      line_id: production.lineId,
      machine_id: production.machineId ?? null,
      supervisor: production.supervisor,
      product_id: production.productId,
      pieces_per_press: production.piecesPerPress,
      presses: production.presses,
      produced: production.produced,
      released_output: production.releasedOutput ?? null,
      output: production.output ?? null,
      created_at: production.createdAt,
      updated_at: production.updatedAt ?? null
    };
  }

  getAll(): Observable<Production[]> {
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

  getById(id: string): Observable<Production | undefined> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          if (error.code === 'PGRST116') return undefined;
          throw error;
        }
        return data ? this.mapToModel(data) : undefined;
      }),
      catchError(err => throwError(() => err))
    );
  }

  create(production: Production): Observable<Production> {
    const dbRecord = this.mapToDb(production);
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

  update(production: Production): Observable<Production> {
    const dbRecord = this.mapToDb(production);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', production.id)
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

  getBySessionId(sessionId: string): Observable<Production[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('session_id', sessionId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  /**
   * Calculates the total produced items.
   * Formula: Produced = Pieces Per Press × Presses
   */
  calculateProduced(piecesPerPress: number, presses: number): number {
    return ProductionUtil.calculateProduced(piecesPerPress, presses);
  }

  /**
   * Builds a Production record with a PiecesPerPress snapshot taken at entry time.
   * ProducedQuantity is ALWAYS system-calculated from NumberOfPresses × PiecesPerPress;
   * any manually supplied produced value is ignored.
   *
   * @throws Error when presses is negative or PiecesPerPress is not configured.
   */
  createProductionRecord(input: ProductionRecordInput): Production {
    if (!ProductionUtil.isValidPressCount(input.presses)) {
      throw new Error('Negative press count is not allowed.');
    }

    if (!ProductionUtil.isConfigured(input.piecesPerPress)) {
      throw new Error('PiecesPerPress is not configured for this product.');
    }

    const piecesPerPress = input.piecesPerPress as number;
    const produced = this.calculateProduced(piecesPerPress, input.presses);

    const record: Production = {
      id: input.id,
      sessionId: input.sessionId,
      date: input.date,
      shiftId: input.shiftId ?? '',
      lineId: input.lineId,
      productId: input.productId,
      supervisor: input.supervisor ?? '',
      piecesPerPress,
      presses: input.presses,
      produced,
      createdAt: input.createdAt,
    };

    if (input.machineId) record.machineId = input.machineId;

    return record;
  }
}