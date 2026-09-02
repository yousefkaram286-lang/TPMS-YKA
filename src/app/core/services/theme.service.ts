// ============================================================
// TPMS — Theme Service
// ============================================================
import { Injectable, signal, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'tpms-theme';
const DEFAULT_THEME: Theme = 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private storage = window.localStorage;

  // Current theme signal
  currentTheme = signal<Theme>(this.getStoredTheme());

  constructor() {
    // Apply theme on initialization
    this.applyTheme(this.currentTheme());

    // Watch for theme changes and apply them
    effect(() => {
      this.applyTheme(this.currentTheme());
      this.saveTheme(this.currentTheme());
    });
  }

  /**
   * Get the stored theme from localStorage
   */
  private getStoredTheme(): Theme {
    try {
      const stored = this.storage.getItem(THEME_STORAGE_KEY);
      return (stored === 'dark' || stored === 'light') ? stored : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  }

  /**
   * Save theme to localStorage
   */
  private saveTheme(theme: Theme): void {
    try {
      this.storage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: Theme): void {
    const htmlElement = this.document.documentElement;
    
    if (theme === 'dark') {
      htmlElement.setAttribute('data-theme', 'dark');
    } else {
      htmlElement.removeAttribute('data-theme');
    }
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme(): void {
    this.currentTheme.set(this.currentTheme() === 'light' ? 'dark' : 'light');
  }

  /**
   * Set a specific theme
   */
  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
  }

  /**
   * Get the current theme
   */
  getTheme(): Theme {
    return this.currentTheme();
  }

  /**
   * Check if current theme is dark
   */
  isDark(): boolean {
    return this.currentTheme() === 'dark';
  }
}
