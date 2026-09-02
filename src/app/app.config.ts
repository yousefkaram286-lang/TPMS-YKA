import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { DatabaseInitService } from './core/services/database-init.service';
import { SupabaseMasterDataSeedService } from './core/services/supabase-master-data-seed.service';

export function initializeDatabase(dbInitService: DatabaseInitService) {
  return () => dbInitService.initialize();
}

export function initializeSupabaseMasterData(seedService: SupabaseMasterDataSeedService) {
  return () => seedService.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), 
    provideAnimationsAsync(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeDatabase,
      deps: [DatabaseInitService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSupabaseMasterData,
      deps: [SupabaseMasterDataSeedService],
      multi: true
    }
  ]
};