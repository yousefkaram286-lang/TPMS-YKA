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

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatMenuModule, MatDividerModule, MatTooltipModule, UserAvatarComponent, RouterModule],
  template: `
    <header class="header">
      <div class="header__left">
        <button
          class="header__mobile-menu"
          (click)="toggleSidebar.emit()"
          aria-label="Open menu"
        >
          <mat-icon>menu</mat-icon>
        </button>
        
        <div class="header__search" *ngIf="showSearch">
          <mat-icon class="header__search-icon">search</mat-icon>
          <input type="text" placeholder="Search..." class="header__search-input" />
          <div class="header__search-shortcut">Ctrl+K</div>
        </div>
      </div>

      <div class="header__right">
        <!-- Theme Toggle -->
        <button 
          class="header__action-btn" 
          (click)="toggleTheme()" 
          [matTooltip]="isDarkMode() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
          matTooltipPosition="below"
          aria-label="Toggle theme"
        >
          <mat-icon>{{ isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        <!-- Notifications (Mock) -->
        <button class="header__action-btn" aria-label="Notifications">
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
            <span>My Profile</span>
          </button>
          <button mat-menu-item routerLink="/settings" *ngIf="isAdmin()">
            <mat-icon>settings</mat-icon>
            <span>Preferences</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()" class="text-danger">
            <mat-icon color="warn">logout</mat-icon>
            <span>Logout</span>
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
    return this.auth.userRole() === 'Admin' ? 'Administrator' : 'User';
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
