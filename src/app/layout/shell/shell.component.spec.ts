// ============================================================
// TPMS — Shell Component: content direction policy
// ------------------------------------------------------------
// Mixed-language safety pass: the shell chrome follows the UI
// language (<html dir>), but each routed page controls its own
// content direction. Only pages marked `data: { rtl: true }`
// may render RTL when Arabic is active; everything else stays
// LTR so untranslated modules keep their English layout.
// ============================================================
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ShellComponent } from './shell.component';
import { TranslationService } from '../../core/services/translation.service';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';

@Component({ selector: 'app-host-cmp', standalone: true, template: `` })
class HostCmp {}

describe('ShellComponent content direction', () => {
  const originalLang = document.documentElement.lang;
  const originalDir = document.documentElement.dir;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        RouterTestingModule.withRoutes([
          {
            path: '',
            component: ShellComponent,
            children: [
              { path: 'dashboard', component: HostCmp },
              { path: 'users', component: HostCmp, data: { rtl: true } },
            ],
          },
        ]),
      ],
    });
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

  function setup(): { router: Router; translation: TranslationService; shell: ShellComponent } {
    const router = TestBed.inject(Router);
    const translation = TestBed.inject(TranslationService);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return { router, translation, shell: fixture.componentInstance };
  }

  it('defaults to LTR content before any navigation completes', () => {
    const { shell } = setup();
    expect(shell.contentDir()).toBe('ltr');
  });

  it('renders a translated page LTR while the app is in English', async () => {
    const { router, shell } = setup();
    await router.navigate(['/users']);
    expect(shell.contentDir()).toBe('ltr');
  });

  it('renders an rtl-marked translated page RTL when Arabic is active', async () => {
    const { router, translation, shell } = setup();
    translation.setLanguage('ar');
    await router.navigate(['/users']);
    expect(shell.contentDir()).toBe('rtl');
  });

  it('keeps untranslated pages LTR even while Arabic (and RTL chrome) is active', async () => {
    const { router, translation, shell } = setup();
    translation.setLanguage('ar');
    await router.navigate(['/dashboard']);
    expect(shell.contentDir()).toBe('ltr');
  });

  it('flips a translated page back to LTR when the app switches to English', async () => {
    const { router, translation, shell } = setup();
    translation.setLanguage('ar');
    await router.navigate(['/users']);
    expect(shell.contentDir()).toBe('rtl');
    translation.setLanguage('en');
    expect(shell.contentDir()).toBe('ltr');
  });
});