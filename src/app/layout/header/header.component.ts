// ============================================================
// TPMS — Header Component
// ============================================================
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatMenuModule, MatDividerModule, MatTooltipModule, UserAvatarComponent, RouterModule, LanguageSwitcherComponent],
  template: `
    <header class="header">
      <div class="header__left">
        <button
          class="header__mobile-menu"
          (click)="toggleSidebar.emit()"
          [attr.aria-label]="translation.translate('header.openMenu')"
        >
          <mat-icon>menu</mat-icon>
        </button>
        
        <div class="header__search" *ngIf="showSearch">
          <mat-icon class="header__search-icon">search</mat-icon>
          <input type="text" [placeholder]="translation.translate('header.search')" class="header__search-input" />
          <div class="header__search-shortcut">{{ translation.translate('header.searchShortcut') }}</div>
        </div>
      </div>

      <div class="header__right">
        <!-- Language Switcher -->
        <app-language-switcher></app-language-switcher>

        <!-- Theme Toggle -->
        <button 
          class="header__action-btn" 
          (click)="toggleTheme()" 
          [matTooltip]="translation.translate(isDarkMode() ? 'header.lightMode' : 'header.darkMode')"
          matTooltipPosition="below"
          [attr.aria-label]="translation.translate(isDarkMode() ? 'header.lightMode' : 'header.darkMode')"
        >
          <mat-icon>{{ isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        <!-- Notifications (Mock) -->
        <button class="header__action-btn" [attr.aria-label]="translation.translate('header.notifications')">
          <mat-icon>notifications_none</mat-icon>
          <span class="header__action-badge">3</span>
        </button>

        <div class="header__divider"></div>

        <!-- User Menu -->
        <button class="header__user-btn" [matMenuTriggerFor]="userMenu">
          <app-user-avatar [user]="currentUser()" size="sm"></app-user-avatar>
          <div class="header__user-text" *ngIf="!isMobile">
            <span class="header__user-name">{{ currentUser()?.displayName }}</span>
            <span class="header__user-role">{{ userRoleTitle() }}</span>
          </div>
          <mat-icon class="header__user-chevron">expand_more</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu" xPosition="before" class="tpms-menu">
          <div class="menu-header">
            <app-user-avatar [user]="currentUser()" size="md"></app-user-avatar>
            <div class="menu-header-info">
              <span class="menu-header-name">{{ currentUser()?.displayName }}</span>
              <span class="menu-header-email">{{ currentUser()?.email }}</span>
            </div>
          </div>
          <mat-divider></mat-divider>
          <button mat-menu-item routerLink="/profile" *ngIf="isAdmin()">
            <mat-icon>person</mat-icon>
            <span>{{ translation.translate('header.myProfile') }}</span>
          </button>
          <button mat-menu-item routerLink="/settings" *ngIf="isAdmin()">
            <mat-icon>settings</mat-icon>
            <span>{{ translation.translate('header.preferences') }}</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()" class="text-danger">
            <mat-icon color="warn">logout</mat-icon>
            <span>{{ translation.translate('nav.logout') }}</span>
          </button>
        </mat-menu>
      </div>
    </header>
  `,
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  @Input() isMobile = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  readonly translation = inject(TranslationService);

  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = this.auth.isAdmin;
  
  showSearch = true;

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Hide search on dashboard
      this.showSearch = event.url !== '/dashboard';
    });
  }

  userRoleTitle(): string {
    return this.auth.userRole() === 'Admin'
      ? this.translation.translate('nav.role.admin')
      : this.translation.translate('nav.role.user');
  }

  logout(): void {
    this.auth.logout();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDark();
  }
}
