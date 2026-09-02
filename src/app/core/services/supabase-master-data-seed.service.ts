import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import {
  computeSupabaseMasterSeedPlan,
  SupabaseSeedConflict
} from '../utils/supabase-master-seed.util';

/** localStorage flag — set ONLY after a fully successful seed so it stays additive. */
export const SUPABASE_MASTER_SEED_DONE_KEY = 'tpms_supabase_master_seed_v1_done';

export interface SupabaseSeedResult {
  linesInserted: number;
  productsInserted: number;
  materialsInserted: number;
  conversionsBackfilled: number;
  mappingsInserted: number;
  conflicts: SupabaseSeedConflict[];
}

const EMPTY_RESULT: SupabaseSeedResult = {
  linesInserted: 0,
  productsInserted: 0,
  materialsInserted: 0,
  conversionsBackfilled: 0,
  mappingsInserted: 0,
  conflicts: []
};

@Injectable({
  providedIn: 'root'
})
export class SupabaseMasterDataSeedService {
  private supabaseService = inject(SupabaseService);

  /**
   * Best-effort bootstrap entry point (APP_INITIALIZER). Never blocks startup:
   * any failure (e.g. table not migrated yet, RLS applied but no session yet) is
   * caught, logged and resolved as `true`.
   */
  initialize(): Observable<boolean> {
    return from(this.runSeed()).pipe(
      tap((result) => {
        console.info('[Supabase] Master data seed complete.', {
          lines: result.linesInserted,
          products: result.productsInserted,
          materials: result.materialsInserted,
          conversions: result.conversionsBackfilled,
          mappings: result.mappingsInserted,
          conflicts: result.conflicts.length
        });
        if (result.conflicts.length > 0) {
          console.warn('[Supabase] Master data seed CONFLICTS (existing values NOT overwritten):', result.conflicts);
        }
      }),
      map(() => true),
      catchError((err) => {
        console.warn('[Supabase] Master data seed skipped (safe to retry on next load):', err?.message ?? err);
        return of(true);
      })
    );
  }

  /** Additive + idempotent + non-destructive. Throws if Supabase is unreachable. */
  async runSeed(): Promise<SupabaseSeedResult> {
    if (localStorage.getItem(SUPABASE_MASTER_SEED_DONE_KEY) === 'true') {
      return { ...EMPTY_RESULT };
    }

    const client = this.supabaseService.client;

    const [linesRes, productsRes, materialsRes, mappingsRes] = await Promise.all([
      client.from('lines').select('*'),
      client.from('products').select('*'),
      client.from('materials').select('*'),
      client.from('line_products').select('*')
    ]);

    const readError = [linesRes.error, productsRes.error, materialsRes.error, mappingsRes.error]
      .filter(e => !!e)
      .map(e => e?.message ?? '')
      .join('; ');
    if (readError) {
      throw new Error(`Supabase master data unavailable (seed skipped): ${readError}`);
    }

    const plan = computeSupabaseMasterSeedPlan(
      linesRes.data ?? [],
      productsRes.data ?? [],
      materialsRes.data ?? [],
      mappingsRes.data ?? []
    );

    // Execute in dependency-safe order: lines → products → materials → mappings.
    if (plan.linesToInsert.length > 0) {
      await this.requireSuccess(client.from('lines').insert(plan.linesToInsert), 'lines');
    }
    if (plan.productsToInsert.length > 0) {
      await this.requireSuccess(client.from('products').insert(plan.productsToInsert), 'products');
    }
    if (plan.materialsToInsert.length > 0) {
      await this.requireSuccess(client.from('materials').insert(plan.materialsToInsert), 'materials');
    }
    for (const backfill of plan.materialConversionBackfills) {
      await this.requireSuccess(
        client.from('materials').update({ conversion_kg_per_m3: backfill.conversion_kg_per_m3, updated_at: backfill.updated_at }).eq('id', backfill.id),
        'materials'
      );
    }
    if (plan.mappingsToInsert.length > 0) {
      await this.requireSuccess(client.from('line_products').insert(plan.mappingsToInsert), 'line_products');
    }

    localStorage.setItem(SUPABASE_MASTER_SEED_DONE_KEY, 'true');

    return {
      linesInserted: plan.linesToInsert.length,
      productsInserted: plan.productsToInsert.length,
      materialsInserted: plan.materialsToInsert.length,
      conversionsBackfilled: plan.materialConversionBackfills.length,
      mappingsInserted: plan.mappingsToInsert.length,
      conflicts: plan.conflicts
    };
  }

  private async requireSuccess(result: PromiseLike<{ error: { message: string } | null }>, table: string): Promise<void> {
    const res = await result;
    if (res.error) {
      throw new Error(`Seed write to '${table}' failed: ${res.error.message}`);
    }
  }
}