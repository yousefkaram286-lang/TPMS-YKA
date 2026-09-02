import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { STORE_NAMES } from '../constants/storage.constants';
import { Product } from '../models/product.model';
import { Material } from '../models/material.model';
import { Recipe } from '../models/recipe.model';
import { computeMasterDataMigration, MasterDataMigrationPlan } from '../utils/master-data-migration.util';

/**
 * MIGRATION VERSION KEY stored in localStorage.
 * 'true' = the Verified Factory Master Data migration has completed.
 * Absence or 'false' = the migration should run (or re-run — it is idempotent).
 */
export const MASTER_DATA_MIGRATION_KEY = 'tpms_master_data_migration_v1_completed';

/**
 * Idempotent migration that normalizes master data to the BUSINESS-CONFIRMED
 * Toblat values:
 *  - normalizes the 7 verified products (IDs preserved when a matching record
 *    already exists; no duplicates created);
 *  - deactivates known demo products (Interlock) — never deletes;
 *  - flags clearly demo/legacy recipes — never deletes them or any historical
 *    transaction;
 *  - leaves lines, machines, product-machine mappings and unrelated products
 *    untouched (they require business input).
 *
 * Safe to run more than once: on the second run every verified product matches
 * by id and is simply re-normalized to the same values.
 */
@Injectable({
  providedIn: 'root'
})
export class MasterDataMigrationService {
  private storageService = inject(StorageService);

  migrate(): Observable<MasterDataMigrationPlan> {
    return forkJoin([
      this.storageService.getAll<Product>(STORE_NAMES.PRODUCTS),
      this.storageService.getAll<Material>(STORE_NAMES.MATERIALS),
      this.storageService.getAll<Recipe>(STORE_NAMES.RECIPES)
    ]).pipe(
      switchMap(([products, materials, recipes]) => {
        const plan = computeMasterDataMigration(products, materials, recipes);

        const ops: Observable<unknown>[] = [
          ...plan.productUpdates.map(p => this.storageService.update(STORE_NAMES.PRODUCTS, p)),
          ...plan.productDeactivations.map(p => this.storageService.update(STORE_NAMES.PRODUCTS, p)),
          ...plan.recipeUpdates.map(r => this.storageService.update(STORE_NAMES.RECIPES, r)),
          ...plan.productCreates.map(p => this.storageService.add(STORE_NAMES.PRODUCTS, p))
        ];

        const apply$ = ops.length > 0
          ? forkJoin(ops).pipe(map(() => plan))
          : of(plan);

        return apply$.pipe(
          tap(() => {
            localStorage.setItem(MASTER_DATA_MIGRATION_KEY, 'true');
            console.log(
              `[MasterDataMigration] Products updated: ${plan.productUpdates.length}, ` +
              `created: ${plan.productCreates.length}, demo deactivated: ${plan.productDeactivations.length}, ` +
              `recipes flagged: ${plan.recipeUpdates.length}.`
            );
          }),
          catchError(error => {
            console.error('[MasterDataMigration] Error during migration:', error);
            return of(plan);
          })
        );
      })
    );
  }

  isCompleted(): boolean {
    return localStorage.getItem(MASTER_DATA_MIGRATION_KEY) === 'true';
  }

  /**
   * Resets the migration flag, allowing it to re-run.
   * USE ONLY FOR TESTING.
   */
  resetForTesting(): void {
    localStorage.removeItem(MASTER_DATA_MIGRATION_KEY);
  }
}