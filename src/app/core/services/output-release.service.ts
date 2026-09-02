import { Injectable, inject } from '@angular/core';
import { Observable, of, from, throwError, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ProductService } from './product.service';
import { LineService } from './line.service';
import { OutputRelease } from '../models/output-release.model';

export interface OutputReleaseInput {
  releaseDate: string;
  lineId: string;
  productId: string;
  releasedQuantity: number;
  notes?: string;
  transactionId: string;
}

@Injectable({
  providedIn: 'root'
})
export class OutputReleaseService {
  private supabaseService = inject(SupabaseService);
  private productService = inject(ProductService);
  private lineService    = inject(LineService);
  private tableName = 'output_releases';

  // Helper to map DB snake_case to frontend camelCase
  private mapToModel(row: any): OutputRelease {
    return {
      id: row.id,
      releaseDate: row.release_date,
      lineId: row.line_id !== null ? row.line_id : undefined,
      productId: row.product_id !== null ? row.product_id : undefined,
      releasedQuantity: row.released_quantity,
      dataSource: row.data_source,
      legacySessionId: row.legacy_session_id !== null ? row.legacy_session_id : undefined,
      notes: row.notes !== null ? row.notes : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper to map frontend camelCase to DB snake_case
  private mapToDb(record: OutputRelease): any {
    return {
      id: record.id,
      release_date: record.releaseDate,
      line_id: record.lineId ?? null,
      product_id: record.productId ?? null,
      released_quantity: record.releasedQuantity,
      data_source: record.dataSource,
      legacy_session_id: record.legacySessionId ?? null,
      notes: record.notes ?? null,
      created_at: record.createdAt,
      updated_at: record.updatedAt ?? null
    };
  }

  getAll(): Observable<OutputRelease[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .order('release_date', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  getById(id: string): Observable<OutputRelease | undefined> {
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

  create(record: OutputRelease): Observable<OutputRelease> {
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

  update(record: OutputRelease): Observable<OutputRelease> {
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

  createIdempotent(input: OutputReleaseInput): Observable<OutputRelease> {
    if (!input.transactionId) {
      return throwError(() => new Error('Submission id is required'));
    }

    const deterministicId = `output_sub_${input.transactionId}`;

    return this.getById(deterministicId).pipe(
      switchMap(existing => {
        if (existing) {
          return of(existing);
        }

        const requiredError = this.validateRequiredFields(input);
        if (requiredError) {
          return throwError(() => requiredError);
        }

        return forkJoin({
          line: this.lineService.getById(input.lineId),
          product: this.productService.getById(input.productId)
        }).pipe(
          switchMap(({ line, product }) => {
            if (!product) {
              return throwError(() => new Error(`Product not found: ${input.productId}`));
            }
            if (!line) {
              return throwError(() => new Error(`Line not found: ${input.lineId}`));
            }

            const record: OutputRelease = {
              id: deterministicId,
              releaseDate: input.releaseDate,
              lineId: input.lineId,
              productId: input.productId,
              releasedQuantity: input.releasedQuantity,
              notes: input.notes,
              dataSource: 'MANUAL_ENTRY',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            // Using create to insert the mapped DB record via Supabase
            return this.create(record);
          })
        );
      }),
      catchError(err => {
        // Unique violation (23505) means concurrent race. The winner already
        // persisted this submission; fetch and return it.
        if (err?.code === '23505' || err?.message?.includes('duplicate key value')) {
          return this.getById(deterministicId).pipe(
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

  private validateRequiredFields(input: OutputReleaseInput): Error | null {
    if (!input.releaseDate) {
      return new Error('Release date is required');
    }
    if (input.releasedQuantity == null || !(input.releasedQuantity > 0)) {
      return new Error('Released quantity must be greater than zero');
    }
    if (!input.lineId) {
      return new Error('Line is required for a manual output release');
    }
    if (!input.productId) {
      return new Error('Product is required for a manual output release');
    }
    return null;
  }
}