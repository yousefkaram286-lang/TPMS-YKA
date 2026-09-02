// ============================================================
// TPMS — User Avatar Component
// ============================================================
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="avatar"
      [class]="'avatar avatar--' + size"
      [style.background]="bgColor"
      [attr.title]="user?.displayName"
    >
      <span class="avatar__initials">{{ initials }}</span>
    </div>
  `,
  styles: [`
    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-weight: 600;
      flex-shrink: 0;
      user-select: none;
      letter-spacing: 0.5px;
    }
    .avatar--sm  { width: 32px; height: 32px; font-size: 12px; border-radius: 8px; }
    .avatar--md  { width: 40px; height: 40px; font-size: 14px; border-radius: 10px; }
    .avatar--lg  { width: 52px; height: 52px; font-size: 18px; border-radius: 12px; }
    .avatar--xl  { width: 64px; height: 64px; font-size: 22px; border-radius: 14px; }
    .avatar__initials { color: #ffffff; line-height: 1; }
  `]
})
export class UserAvatarComponent implements OnChanges {
  @Input() user: User | null = null;
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';

  initials = '';
  bgColor = '#4F46E5'; // default: indigo

  // Only TPMS-aligned brand colors — no green
  private readonly COLORS = [
    '#4F46E5', // Indigo (primary)
    '#2563EB', // Blue
    '#7C3AED', // Violet
    '#0891B2', // Cyan
    '#1E3A8A', // Dark blue
    '#6D28D9', // Purple
    '#1D4ED8', // Blue-700
    '#3730A3', // Indigo-700
  ];

  ngOnChanges(): void {
    if (this.user?.displayName) {
      const parts = this.user.displayName.trim().split(' ');
      this.initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();

      // Deterministic color from name
      let hash = 0;
      for (const ch of this.user.displayName) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
      this.bgColor = this.COLORS[Math.abs(hash) % this.COLORS.length];
    } else {
      this.initials = '?';
      this.bgColor = '#4F46E5';
    }
  }
}

