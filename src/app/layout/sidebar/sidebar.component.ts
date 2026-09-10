// ============================================================
// TPMS — Sidebar Component
// ============================================================
import { Component, Input, Output, EventEmitter, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { AuthService } from '../../core/services/auth.service';
import { NAV_ITEMS } from '../../core/constants/nav-items';
import { NavItem } from '../../core/models/nav-item.model';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule, RouterModule, RouterLinkActive,
    MatIconModule, MatTooltipModule, MatRippleModule,
    UserAvatarComponent, StatusBadgeComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  @Input()  collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() navItemClicked  = new EventEmitter<void>();

  private auth = inject(AuthService);
  readonly translation = inject(TranslationService);

  readonly currentUser = this.auth.currentUser;
  readonly isAdmin     = this.auth.isAdmin;

  readonly navItems = computed<NavItem[]>(() =>
    NAV_ITEMS.filter((item) => {
      if (!item.roles) return true;
      const role = this.auth.userRole();
      return role ? item.roles.includes(role) : false;
    })
  );

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  logout(): void {
    this.auth.logout();
  }

  onNavClick(): void {
    this.navItemClicked.emit();
  }

  get roleLabel(): string {
    return this.auth.userRole() === 'Admin'
      ? this.translation.translate('nav.role.admin')
      : this.translation.translate('nav.role.user');
  }

  /** Translate a nav item label via `nav.<id>` key, falling back to the data label. */
  navLabel(item: NavItem): string {
    const key = `nav.${item.id}`;
    const value = this.translation.translate(key);
    return value !== key ? value : item.label;
  }

  get roleBadgeVariant(): 'primary' | 'success' {
    return this.auth.isAdmin() ? 'primary' : 'success';
  }

  /** Collapse-chevron icon, mirrored for RTL so it keeps pointing across the edge. */
  get collapseIcon(): string {
    const rtl = this.translation.isArabic();
    return this.collapsed
      ? (rtl ? 'chevron_left' : 'chevron_right')
      : (rtl ? 'chevron_right' : 'chevron_left');
  }
}
