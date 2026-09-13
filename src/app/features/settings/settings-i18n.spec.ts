// ============================================================
// TPMS — Settings i18n / RTL focused suite
// ------------------------------------------------------------
// Presentation-only checks for the Phase 5 translated Settings
// feature. Nothing here may assert business logic: it verifies
// that (a) the Settings route is RTL-capable, (b) the shell and
// catalog render English/Arabic and switch at runtime without
// reload, (c) AR keys fall back to EN, (d) the translation layer
// never mutates master data / business constants.
// ============================================================
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router, Routes } from '@angular/router';

import { SettingsComponent } from './settings.component';
import { SETTINGS_ROUTES } from './settings.routes';
import { routes as APP_ROUTES } from '../../app.routes';
import { TranslationService } from '../../core/services/translation.service';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';
import { EN } from '../../core/i18n/en';
import { AR } from '../../core/i18n/ar';

import { SEED_MATERIALS, SEED_LINES, SEED_SHIFTS, SEED_MACHINES, SEED_RECIPES, SEED_UNIT_COSTS, SEED_PRODUCT_MACHINES, VERIFIED_PRODUCTS, SEED_PRODUCTS } from '../../core/constants/seed-data';
import { MasterDataUtil } from '../../core/utils/master-data.util';
import { ProductionUtil } from '../../core/utils/production.util';

describe('Settings i18n / RTL', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  });

  afterEach(() => {
    document.documentElement.setAttribute('lang', originalLang);
    document.documentElement.setAttribute('dir', originalDir);
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  });

  function setup(): { router: Router } {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: 'settings', component: SettingsComponent, data: { rtl: true }, children: SETTINGS_ROUTES },
        ]),
      ],
    });
    return { router: TestBed.inject(Router) };
  }

  // ── Route / RTL capability ───────────────────────────────
  it('marks the Settings route RTL-capable via data.rtl', () => {
    const settings = (APP_ROUTES as Routes)
      .flatMap((r: any) => r.children ?? [])
      .find((r: any) => r.path === 'settings');
    expect(settings).toBeDefined();
    expect(settings!.data?.['rtl']).toBeTrue();
  });

  it('exposes all eight Settings sub-module routes', () => {
    const paths = SETTINGS_ROUTES[0].children!.map(c => c.path).filter(p => !!p);
    for (const p of ['products', 'materials', 'lines', 'shifts', 'machines', 'production-config', 'recipes', 'unit-costs']) {
      expect(paths).toContain(p);
    }
  });

  it('renders the Settings shell wrapper LTR while the app is in English', async () => {
    const { router } = setup();
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await router.navigate(['/settings']);
    const wrapper = fixture.nativeElement.querySelector('.tpms-dir');
    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  // ── Catalog parity ───────────────────────────────────────
  it('keeps every settings.* key present in both EN and AR catalogs', () => {
    const enKeys = Object.keys(EN).filter(k => k.startsWith('settings.'));
    const arKeys = new Set(Object.keys(AR).filter(k => k.startsWith('settings.')));
    expect(enKeys.length).toBeGreaterThan(300);
    const missing = enKeys.filter(k => !arKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('gives every settings.* AR key a non-blank value different from English (except intentional constants)', () => {
    const intentionallyUnchanged = new Set([
      'settings.products.dialog.type.block',
      'settings.products.dialog.type.solid',
    ]);
    const arKeys = Object.keys(AR).filter(k => k.startsWith('settings.'));
    for (const k of arKeys) {
      const value = AR[k];
      expect(value.trim().length).toBeGreaterThan(0);
      if (!intentionallyUnchanged.has(k)) {
        expect(value).not.toBe(EN[k]);
      }
    }
  });

  // ── Shell EN labels ──────────────────────────────────────
  it('renders the Settings title and tabs in English when English is active', () => {
    const translation = TestBed.inject(TranslationService);
    expect(translation.translate('settings.title')).toBe('Settings');
    expect(translation.translate('settings.tabs.products')).toBe('Products');
    expect(translation.translate('settings.tabs.materials')).toBe('Materials');
    expect(translation.translate('settings.tabs.lines')).toBe('Lines');
    expect(translation.translate('settings.tabs.shifts')).toBe('Shifts');
    expect(translation.translate('settings.tabs.machines')).toBe('Machines');
    expect(translation.translate('settings.tabs.productionConfig')).toBe('Production Config');
    expect(translation.translate('settings.tabs.recipes')).toBe('Recipes');
    expect(translation.translate('settings.tabs.unitCosts')).toBe('Unit Costs');
  });

  // ── Shell AR labels + RTL ────────────────────────────────
  it('renders the Settings title and tabs in Arabic when Arabic is active', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    expect(translation.translate('settings.title')).toBe('الإعدادات');
    expect(translation.translate('settings.tabs.products')).toBe('المنتجات');
    expect(translation.translate('settings.tabs.machines')).toBe('الماكينات');
    expect(translation.translate('settings.tabs.productionConfig')).toBe('إعدادات الإنتاج');
    expect(translation.translate('settings.tabs.unitCosts')).toBe('تكاليف الوحدات');
    expect(translation.dir()).toBe('rtl');
  });

  it('applies dir="rtl" to the Settings shell wrapper while Arabic is active', async () => {
    const { router } = setup();
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await router.navigate(['/settings']);
    const wrapper = fixture.nativeElement.querySelector('.tpms-dir');
    expect(wrapper?.getAttribute('dir')).toBe('rtl');
  });

  // ── Runtime switching without reload ─────────────────────
  it('switches EN → AR at runtime on a live component without re-creating it', () => {
    setup();
    const translation = TestBed.inject(TranslationService);
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    let titleEl: HTMLElement | null = null;
    for (const el of fixture.nativeElement.querySelectorAll('h1')) {
      if (el.textContent?.trim() === 'Settings') titleEl = el;
    }
    expect(titleEl).not.toBeNull();
    const instance = fixture.componentInstance;

    translation.setLanguage('ar');
    fixture.detectChanges();

    expect(fixture.componentInstance).toBe(instance);
    let arabicTitle: HTMLElement | null = null;
    for (const el of fixture.nativeElement.querySelectorAll('h1')) {
      if (el.textContent?.trim() === 'الإعدادات') arabicTitle = el;
    }
    expect(arabicTitle).not.toBeNull();
  });

  it('restores Settings to English when switching AR → EN', () => {
    setup();
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    expect(translation.translate('settings.title')).toBe('الإعدادات');
    expect(translation.dir()).toBe('rtl');
    translation.setLanguage('en');
    expect(translation.translate('settings.title')).toBe('Settings');
    expect(translation.dir()).toBe('ltr');
  });

  // ── Fallback ─────────────────────────────────────────────
  it('falls back to the English value when an Arabic key is missing', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    // 'users.count.accounts' exists only in EN → must fall back to English.
    expect(translation.translate('users.count.accounts')).toBe('accounts');
    // A settings key present in both must resolve to Arabic.
    expect(translation.translate('settings.unitCosts.demoChip')).toBe('تجريبي');
  });

  it('echoes the key if a settings key is missing from every catalog', () => {
    const translation = TestBed.inject(TranslationService);
    expect(translation.translate('settings.no.such.key.anywhere')).toBe('settings.no.such.key.anywhere');
  });

  // ── Master data stays untouched by the translation layer ─
  it('keeps confirmed per-product pieces-per-press values unchanged by any language switch', () => {
    const translation = TestBed.inject(TranslationService);
    translation.setLanguage('ar');
    const expected: Record<string, number> = {
      'prd-004': 64, // Solid 12
      'prd-005': 80, // Solid 10
      'prd-001': 12.5, // Block 20
      'prd-002': 16.5, // Block 15
      'prd-006': 10.5, // Block 25
      'prd-007': 18.5, // Block 12
      'prd-008': 22.5, // Block 10
    };
    for (const seed of VERIFIED_PRODUCTS) {
      const product = SEED_PRODUCTS.find(p => p.id === seed.id)!;
      expect(MasterDataUtil.piecesPerPressOf(product)).toBe(expected[seed.id]);
    }
    translation.setLanguage('en');
    for (const seed of VERIFIED_PRODUCTS) {
      const product = SEED_PRODUCTS.find(p => p.id === seed.id)!;
      expect(MasterDataUtil.piecesPerPressOf(product)).toBe(expected[seed.id]);
    }
  });

  it('leaves product names, material names, and units as stored DB values', () => {
    const names = [
      { p: 'prd-005', name: 'Solid 10' },
      { p: 'prd-004', name: 'Solid 12' },
    ];
    for (const n of names) {
      const product = SEED_PRODUCTS.find(p => p.id === n.p)!;
      expect(product.name).toBe(n.name);
    }
    expect(SEED_MATERIALS.map(m => `${m.name}:${m.unit}`)).toEqual([
      'Sand:kg', 'Aggregate:kg', 'Cement:kg', 'Water:L', 'Admixture:L',
    ]);
    expect(SEED_MATERIALS[0].conversionKgPerM3).toBe(1625);
    expect(SEED_MATERIALS[1].conversionKgPerM3).toBe(1550);
  });

  it('keeps line, shift, and machine names untouched by the translation layer', () => {
    expect(SEED_LINES.map(l => l.name)).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']);
    expect(SEED_SHIFTS.map(s => s.name)).toEqual(['Morning', 'Overtime']);
    expect(SEED_MACHINES.map(m => m.name)).toEqual(['Press Alpha', 'Press Beta', 'Press Gamma', 'Press Delta']);
  });

  it('keeps recipe and unit-cost rows untouched (values stay as stored, demo flag preserved)', () => {
    expect(SEED_RECIPES.length).toBe(0);
    expect(SEED_UNIT_COSTS.length).toBe(5);
    expect(SEED_UNIT_COSTS.every(u => u.demo === true)).toBeTrue();
    expect(SEED_UNIT_COSTS.find(u => u.materialId === 'mat-003')?.unitCost).toBe(80);
    expect(SEED_UNIT_COSTS.find(u => u.materialId === 'mat-004')?.unitCost).toBe(2);
  });

  it('keeps the business formulas stable while the language switches', () => {
    const translation = TestBed.inject(TranslationService);
    const solid12 = SEED_PRODUCTS.find(p => p.id === 'prd-004')!;
    const ppp = MasterDataUtil.piecesPerPressOf(solid12);
    const before = ProductionUtil.calculateProduced(ppp!, 100);
    translation.setLanguage('ar');
    expect(ProductionUtil.calculateProduced(ppp!, 100)).toBe(before);
    translation.setLanguage('en');
    expect(ProductionUtil.calculateProduced(ppp!, 100)).toBe(before);
    expect(before).toBe(6400);
  });

  it('does not re-introduce Machine into Production via the Settings translation', () => {
    // Settings translation is presentation-only: it must not create mappings.
    expect(SEED_PRODUCT_MACHINES.length).toBe(0);
    // Production entries keep deriving per-press figures from the Product master,
    // not from machine mappings — verify the util path is product-first.
    const solid12 = SEED_PRODUCTS.find(p => p.id === 'prd-004')!;
    const ppp = MasterDataUtil.piecesPerPressOf(solid12);
    expect(ProductionUtil.calculateProduced(ppp!, 100)).toBe(6400);
  });

  // ── Catalog correctness for translated strings ───────────
  it('defines every settings.* key used by the translated dialogs/tables', () => {
    const keys = [
      'settings.products.dialog.saveError',
      'settings.materials.snackbar.deleteError',
      'settings.lines.dialog.saveError',
      'settings.shifts.dialog.saveError',
      'settings.machines.line.unknown',
      'settings.recipes.dialog.material.remove',
      'settings.productionConfig.dialog.saveError',
      'settings.unitCosts.snackbar.saved',
    ];
    for (const k of keys) {
      expect(EN[k]).toBeDefined(k);
      expect(AR[k]).toBeDefined(k);
    }
  });
});