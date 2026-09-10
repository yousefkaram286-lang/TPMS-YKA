import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { UserManagementService } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, PageHeaderComponent, AppCardComponent, EmptyStateComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userSvc = inject(UserManagementService);
  private auth = inject(AuthService);
  readonly translation = inject(TranslationService);

  readonly currentUser = this.auth.currentUser;

  users: User[] = [];
  loading = true;
  creating = false;
  saving = false;
  busyUser: string | null = null;

  message: { success: boolean; text: string } | null = null;

  createForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    username: ['', [Validators.required]],
    displayName: ['']
  });

  editingUser: User | null = null;
  editMessage: { success: boolean; text: string } | null = null;

  editForm: FormGroup = this.fb.group({
    displayName: ['', [Validators.required]],
    username: ['', [Validators.required]],
    role: ['User', [Validators.required]],
    active: [true]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      this.users = await this.userSvc.listUsers();
    } catch (err: any) {
      this.message = { success: false, text: err?.message ?? this.translation.translate('users.error.loadFailed') };
    } finally {
      this.loading = false;
    }
  }

  async createUser(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.message = null;

    try {
      const result = await this.userSvc.createUser(this.createForm.value);
      if (result.success) {
        this.message = { success: true, text: this.translation.translate('users.success.created') };
        this.createForm.reset();
        await this.loadUsers();
      } else {
        this.message = { success: false, text: result.error || this.translation.translate('users.error.unexpected') };
      }
    } catch (err) {
      this.message = { success: false, text: this.translation.translate('users.error.unexpected') };
    } finally {
      this.creating = false;
      if (this.message?.success) {
        setTimeout(() => this.message = null, 3000);
      }
    }
  }

  // ── Edit / Activate / Deactivate ──────────────────────────────────

  isSelf(user: User): boolean {
    const me = this.currentUser();
    return !!me && me.id === user.id;
  }

  openEdit(user: User): void {
    this.editingUser = user;
    this.editMessage = null;
    this.editForm.setValue({
      displayName: user.displayName || '',
      username: user.username || '',
      role: user.role,
      active: user.active
    });
  }

  closeEdit(): void {
    this.editingUser = null;
    this.editMessage = null;
  }

  async saveEdit(): Promise<void> {
    const target = this.editingUser;
    if (!target || this.editForm.invalid) return;

    const { displayName, username, role, active } = this.editForm.value;

    // Safety guard (UI-level, no RLS change): an admin must not lock
    // themselves out by demoting or deactivating their own account.
    if (this.isSelf(target) && (role !== 'Admin' || !active)) {
      this.editMessage = {
        success: false,
        text: this.translation.translate('users.error.selfChange')
      };
      return;
    }

    this.saving = true;
    this.editMessage = null;

    try {
      const result = await this.userSvc.updateUser(target.id, {
        displayName,
        username,
        role,
        active
      });

      if (result.success) {
        this.closeEdit();
        await this.loadUsers();
        this.message = { success: true, text: this.translation.translate('users.success.updated') };
        this.scheduleMessageClear();
      } else {
        this.editMessage = { success: false, text: result.error || 'Failed to update user.' };
      }
    } catch (err) {
      this.editMessage = { success: false, text: 'An unexpected error occurred.' };
    } finally {
      this.saving = false;
    }
  }

  async toggleActive(user: User): Promise<void> {
    if (user.active && this.isSelf(user)) {
      this.message = { success: false, text: this.translation.translate('users.error.selfDeactivate') };
      this.scheduleMessageClear();
      return;
    }
    if (this.busyUser) return;

    this.busyUser = user.id;
    this.message = null;

    const name = user.displayName || user.username || this.translation.translate('users.role.user');

    try {
      const result = await this.userSvc.updateUser(user.id, { active: !user.active });

      if (result.success) {
        await this.loadUsers();
        this.message = {
          success: true,
          text: user.active
            ? this.translation.translate('users.success.deactivated', { name })
            : this.translation.translate('users.success.activated', { name })
        };
        this.scheduleMessageClear();
      } else {
        this.message = { success: false, text: result.error || this.translation.translate('users.error.unexpected') };
      }
    } catch (err) {
      this.message = { success: false, text: this.translation.translate('users.error.unexpected') };
    } finally {
      this.busyUser = null;
    }
  }

  /** Display label for a role, keeping the underlying 'Admin'/'User' value unchanged. */
  roleLabel(role: string): string {
    return role === 'Admin'
      ? this.translation.translate('users.role.admin')
      : this.translation.translate('users.role.user');
  }

  private scheduleMessageClear(): void {
    setTimeout(() => this.message = null, 4000);
  }
}