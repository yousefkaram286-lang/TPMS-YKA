import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, from } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { STORE_NAMES, SEED_FLAG_KEY } from '../constants/storage.constants';
import { OutputReleaseMigrationService, OUTPUT_RELEASE_MIGRATION_KEY } from './output-release-migration.service';
import { MasterDataMigrationService } from './master-data-migration.service';
import { computePiecesPerPressBackfill } from '../utils/pieces-per-press-migration.util';
import {
  SEED_USERS,
  SEED_PRODUCTS,
  SEED_MATERIALS,
  SEED_LINES,
  SEED_SHIFTS,
  SEED_MACHINES,
  SEED_RECIPES,
  SEED_UNIT_COSTS,
  SEED_PRODUCT_MACHINES,
  SEED_LINE_PRODUCTS
} from '../constants/seed-data';
import { Line } from '../models/line.model';
import { Material } from '../models/material.model';
import { LineProductMapping } from '../models/line-product.model';
import { UnitCost } from '../models/unit-cost.model';
import { computeFactoryConfigMigration } from '../utils/factory-config-migration.util';

/** localStorage flag for the business-confirmed factory configuration reconciliation (Lines 1–5, conversions, Line↔Product mappings). */
export const FACTORY_CONFIG_MIGRATION_KEY = 'tpms_factory_config_v6_migrated';

@Injectable({
  providedIn: 'root'
})
export class DatabaseInitService {
  private storageService = inject(StorageService);
  private outputReleaseMigration = inject(OutputReleaseMigrationService);
  private masterDataMigration = inject(MasterDataMigrationService);

  /**
   * Initializes the database connection and seeds data if it hasn't been seeded yet.
   */
  initialize(): Observable<boolean> {
    return from(this.storageService.connect()).pipe(
      switchMap(() => {
        const isSeededV3 = localStorage.getItem(SEED_FLAG_KEY);

        const nextMigration = (): Observable<boolean> => {
          const isQualityMigrated = localStorage.getItem('tpms_db_quality_migrated_v4');
          const isOutputMigrated = localStorage.getItem(OUTPUT_RELEASE_MIGRATION_KEY);
          const isPiecesPerPressMigrated = localStorage.getItem('tpms_db_piecesperpress_migrated');
          const isAdmixtureDeactivated = localStorage.getItem('tpms_db_admixture_deactivated');
          const isFactoryConfigMigrated = localStorage.getItem(FACTORY_CONFIG_MIGRATION_KEY);

          const runPiecesPerPressMigration = (): Observable<boolean> => {
            if (isPiecesPerPressMigrated !== 'true') {
              console.log('[Init] Running PiecesPerPress backfill migration...');
              return this.migratePiecesPerPress().pipe(switchMap(() => runAdmixtureDeactivation()));
            }
            return runAdmixtureDeactivation();
          };

          const runAdmixtureDeactivation = (): Observable<boolean> => {
            if (isAdmixtureDeactivated !== 'true') {
              console.log('[Init] Deactivating legacy Admixture material...');
              return this.deactivateAdmixture().pipe(switchMap(() => runOutputMigration()));
            }
            return runOutputMigration();
          };

          const runOutputMigration = (): Observable<boolean> => {
            if (isOutputMigrated !== 'true') {
              console.log('[Init] Running Output Release migration...');
              return this.outputReleaseMigration.migrate().pipe(
                map(verification => {
                  if (!verification.totalsMatch) {
                    console.error('[Init] Output Release migration total mismatch!', verification);
                  }
                  return true; // never block app startup
                }),
                switchMap(() => runMasterDataMigration())
              );
            }
            return runMasterDataMigration();
          };

          const runMasterDataMigration = (): Observable<boolean> => {
            if (this.masterDataMigration.isCompleted()) {
              return of(true);
            }
            console.log('[Init] Running Verified Factory Master Data migration...');
            return this.masterDataMigration.migrate().pipe(map(() => true));
          };

          const runFactoryConfigMigration = (): Observable<boolean> => {
            if (isFactoryConfigMigrated === 'true') {
              return of(true);
            }
            console.log('[Init] Running Factory Configuration reconciliation (Lines 1–5, conversions, Line↔Product mappings)...');
            return this.migrateFactoryConfig().pipe(map(() => true));
          };

          if (isQualityMigrated !== 'true') {
            console.log('Migrating Quality Tests to V4 (adding decisionSource)...');
            return this.migrateQualityTests().pipe(switchMap(() => runPiecesPerPressMigration()));
          }
          return runPiecesPerPressMigration().pipe(switchMap(() => runFactoryConfigMigration()));
        };

        if (isSeededV3 === 'true') {
          console.log('IndexedDB v3 already seeded.');
          return nextMigration();
        }

        const isSeededV2 = localStorage.getItem('tpms_db_seeded_v2');

        if (isSeededV2 === 'true') {
          console.log('Migrating IndexedDB to v3... Seeding Product Machine configs.');
          return this.migrateToV3().pipe(switchMap(() => nextMigration()));
        }

        const isSeededV1 = localStorage.getItem('tpms_db_seeded');

        if (isSeededV1 === 'true') {
          console.log('Migrating IndexedDB to v2... Clearing incompatible stores.');
          return this.migrateToV2().pipe(switchMap(() => nextMigration()));
        }

        console.log('Seeding IndexedDB with initial data (v3)...');
        return this.seedData().pipe(switchMap(() => nextMigration()));
      }),
      catchError(error => {
        console.error('Database initialization failed:', error);
        return of(true);
      })
    );
  }

  /**
   * Idempotent migration: assigns decisionSource = 'LEGACY_AUTO_CALCULATED'
   * to all existing quality tests that lack a decisionSource field.
   */
  private migrateQualityTests(): Observable<boolean> {
    return this.storageService.getAll<any>(STORE_NAMES.QUALITY_TESTS).pipe(
      switchMap(tests => {
        const updates = tests
          .filter(test => !test.decisionSource)
          .map(test => {
            test.decisionSource = 'LEGACY_AUTO_CALCULATED';
            return this.storageService.update(STORE_NAMES.QUALITY_TESTS, test);
          });

        if (updates.length === 0) {
          localStorage.setItem('tpms_db_quality_migrated_v4', 'true');
          return of(true);
        }

        return forkJoin(updates).pipe(
          tap(() => {
            console.log(`Migrated ${updates.length} quality tests with LEGACY_AUTO_CALCULATED decisionSource.`);
            localStorage.setItem('tpms_db_quality_migrated_v4', 'true');
          }),
          map(() => true),
          catchError(error => {
            console.error('Error during quality tests migration:', error);
            return of(false);
          })
        );
      })
    );
  }

  private migrateToV2(): Observable<boolean> {
    const clearOps = [
      this.storageService.clear(STORE_NAMES.RECIPES),
      this.storageService.clear(STORE_NAMES.UNIT_COSTS),
      this.storageService.clear(STORE_NAMES.MATERIAL_RECORDS),
    ];

    return forkJoin(clearOps).pipe(
      switchMap(() => {
        console.log('Incompatible stores cleared. Seeding v2 specific data...');
        const seedOps = [
          ...SEED_MATERIALS.map(mat => this.storageService.add(STORE_NAMES.MATERIALS, mat)),
          ...SEED_RECIPES.map(recipe => this.storageService.add(STORE_NAMES.RECIPES, recipe)),
          ...SEED_UNIT_COSTS.map(cost => this.storageService.add(STORE_NAMES.UNIT_COSTS, cost)),
        ];
        return forkJoin(seedOps);
      }),
      tap(() => {
        console.log('Migration to v2 complete.');
        localStorage.setItem(SEED_FLAG_KEY, 'true');
      }),
      map(() => true),
      catchError(error => {
        console.error('Error during database migration:', error);
        return of(false);
      })
    );
  }

  private migrateToV3(): Observable<boolean> {
    const seedOps = SEED_PRODUCT_MACHINES.map(pm => this.storageService.add(STORE_NAMES.PRODUCT_MACHINES, pm));

    if (seedOps.length === 0) {
      localStorage.setItem(SEED_FLAG_KEY, 'true');
      return of(true);
    }

    return forkJoin(seedOps).pipe(
      tap(() => {
        console.log('Migration to v3 complete.');
        localStorage.setItem(SEED_FLAG_KEY, 'true');
      }),
      map(() => true),
      catchError(error => {
        console.error('Error during database migration to v3:', error);
        return of(false);
      })
    );
  }

  private seedData(): Observable<boolean> {
    const seedOperations = [
      ...SEED_USERS.map(user => this.storageService.add(STORE_NAMES.USERS, user)),
      ...SEED_PRODUCTS.map(product => this.storageService.add(STORE_NAMES.PRODUCTS, product)),
      ...SEED_MATERIALS.map(mat => this.storageService.add(STORE_NAMES.MATERIALS, mat)),
      ...SEED_LINES.map(line => this.storageService.add(STORE_NAMES.LINES, line)),
      ...SEED_SHIFTS.map(shift => this.storageService.add(STORE_NAMES.SHIFTS, shift)),
      ...SEED_MACHINES.map(machine => this.storageService.add(STORE_NAMES.MACHINES, machine)),
      ...SEED_RECIPES.map(recipe => this.storageService.add(STORE_NAMES.RECIPES, recipe)),
      ...SEED_UNIT_COSTS.map(cost => this.storageService.add(STORE_NAMES.UNIT_COSTS, cost)),
      ...SEED_PRODUCT_MACHINES.map(pm => this.storageService.add(STORE_NAMES.PRODUCT_MACHINES, pm)),
      ...SEED_LINE_PRODUCTS.map(lp => this.storageService.add(STORE_NAMES.LINE_PRODUCTS, lp)),
    ];

    if (seedOperations.length === 0) {
      localStorage.setItem(SEED_FLAG_KEY, 'true');
      return of(true);
    }

    return forkJoin(seedOperations).pipe(
      tap(() => {
        console.log('IndexedDB v3 seed complete.');
        localStorage.setItem(SEED_FLAG_KEY, 'true');
      }),
      map(() => true),
      catchError(error => {
        console.error('Error during database seeding:', error);
        return of(false);
      })
    );
  }

  /**
   * Idempotent migration: backfills Product.piecesPerPress from
   * ProductMachineConfig where the Product has no value yet.
   * Does NOT overwrite existing Product.piecesPerPress values.
   *
   * Safety rules:
   * - Products with piecesPerPress already configured (> 0) are never touched.
   * - Collects ALL distinct positive legacy values per Product.
   * - 1 distinct value → safely backfill.
   * - 0 distinct values → leave unconfigured.
   * - 2+ distinct values → leave unconfigured (conflict; requires manual resolution).
   */
  private migratePiecesPerPress(): Observable<boolean> {
    return forkJoin([
      this.storageService.getAll<any>(STORE_NAMES.PRODUCTS),
      this.storageService.getAll<any>(STORE_NAMES.PRODUCT_MACHINES)
    ]).pipe(
      switchMap(([products, configs]) => {
        const result = computePiecesPerPressBackfill(products, configs);

        if (result.conflicts.length > 0) {
          console.warn('[PiecesPerPress Migration] CONFLICT — multiple distinct legacy values:', result.conflicts);
        }

        if (result.migrated.length === 0) {
          localStorage.setItem('tpms_db_piecesperpress_migrated', 'true');
          return of(true);
        }

        const updates = result.migrated.map(({ productId, piecesPerPress }) => {
          const product = products.find(p => p.id === productId);
          product.piecesPerPress = piecesPerPress;
          return this.storageService.update(STORE_NAMES.PRODUCTS, product);
        });

        return forkJoin(updates).pipe(
          tap(() => {
            console.log(`PiecesPerPress backfill complete: ${result.migrated.length} migrated, ${result.conflicts.length} conflicts.`);
            localStorage.setItem('tpms_db_piecesperpress_migrated', 'true');
          }),
          map(() => true),
          catchError(error => {
            console.error('Error during PiecesPerPress migration:', error);
            return of(false);
          })
        );
      })
    );
  }

  /**
   * Idempotent reconciliation to the BUSINESS-CONFIRMED factory configuration:
   *   - Lines 1 … 5 (rename existing lin-001…003 in place, create lin-004/005)
   *   - Sand.conversionKgPerM3 = 1625, Aggregate.conversionKgPerM3 = 1550
   *     (backfilled ONLY when unset; operator-set values are never overwritten)
   *   - Line ↔ Product mappings (Line 1/2 → all 7 products, Line 3/4 → Solid only,
   *     Line 5 intentionally empty until the Interlock master is confirmed)
   * Never deletes any records. Historical Production / Quality / Output Release
   * records keep their stored kg totals and Line ids untouched.
   */
  private migrateFactoryConfig(): Observable<boolean> {
    const now = new Date().toISOString();
    return forkJoin([
      this.storageService.getAll<Line>(STORE_NAMES.LINES),
      this.storageService.getAll<Material>(STORE_NAMES.MATERIALS),
      this.storageService.getAll<LineProductMapping>(STORE_NAMES.LINE_PRODUCTS),
      this.storageService.getAll<UnitCost>(STORE_NAMES.UNIT_COSTS)
    ]).pipe(
      switchMap(([lines, materials, lineProducts, unitCosts]) => {
        const plan = computeFactoryConfigMigration(lines, materials, lineProducts, unitCosts, { now });

        const ops: Observable<any>[] = [
          ...plan.lineUpdates.map(l => this.storageService.update(STORE_NAMES.LINES, l)),
          ...plan.lineCreates.map(l => this.storageService.add(STORE_NAMES.LINES, l)),
          ...plan.materialUpdates.map(m => this.storageService.update(STORE_NAMES.MATERIALS, m)),
          ...plan.lineProductCreates.map(lp => this.storageService.add(STORE_NAMES.LINE_PRODUCTS, lp)),
          ...plan.unitCostUpdates.map(c => this.storageService.update(STORE_NAMES.UNIT_COSTS, c))
        ];

        if (ops.length === 0) {
          localStorage.setItem(FACTORY_CONFIG_MIGRATION_KEY, 'true');
          return of(true);
        }

        return forkJoin(ops).pipe(
          tap(() => {
            console.log(
              `Factory Config reconciliation complete: ` +
              `${plan.lineUpdates.length} line(s) renamed, ${plan.lineCreates.length} line(s) created, ` +
              `${plan.materialUpdates.length} conversion factor(s) backfilled, ` +
              `${plan.lineProductCreates.length} Line↔Product mapping(s) added, ` +
              `${plan.unitCostUpdates.length} unit cost(s) marked demo.`
            );
            localStorage.setItem(FACTORY_CONFIG_MIGRATION_KEY, 'true');
          }),
          map(() => true),
          catchError(error => {
            console.error('Error during Factory Config reconciliation:', error);
            return of(false);
          })
        );
      })
    );
  }

  /**
   * Idempotent migration: marks the legacy Admixture material as inactive
   * so it no longer appears as a selectable operational material.
   * Does not delete any records.
   */
  private deactivateAdmixture(): Observable<boolean> {
    return this.storageService.getAll<any>(STORE_NAMES.MATERIALS).pipe(
      switchMap(materials => {
        const admixtures = materials.filter(
          m => m.name === 'Admixture' && m.active === true
        );

        if (admixtures.length === 0) {
          localStorage.setItem('tpms_db_admixture_deactivated', 'true');
          return of(true);
        }

        const updates = admixtures.map(m => {
          m.active = false;
          return this.storageService.update(STORE_NAMES.MATERIALS, m);
        });

        return forkJoin(updates).pipe(
          tap(() => {
            console.log(`Deactivated ${updates.length} legacy Admixture material(s).`);
            localStorage.setItem('tpms_db_admixture_deactivated', 'true');
          }),
          map(() => true),
          catchError(error => {
            console.error('Error during Admixture deactivation:', error);
            return of(false);
          })
        );
      })
    );
  }
}
