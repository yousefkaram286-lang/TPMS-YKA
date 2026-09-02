import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { AuthService } from '../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPass = control.get('newPassword')?.value;
  const confirmPass = control.get('confirmPassword')?.value;
  if (newPass && confirmPass && newPass !== confirmPass) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, PageHeaderComponent, AppCardComponent, UserAvatarComponent],
  template: `
    <div class="profile-page page-content">
      <app-page-header
        title="My Profile"
        subtitle="Manage your personal information and security settings"
        icon="person"
      ></app-page-header>

      <div class="profile-content">
        <!-- Personal Information Section -->
        <app-card title="Personal Information" class="profile-card">
          <div class="avatar-section">
            <app-user-avatar [user]="currentUser()" size="xl"></app-user-avatar>
            <div class="avatar-info">
              <h3>{{ currentUser()?.displayName }}</h3>
              <p>{{ currentUser()?.email }}</p>
              <div class="role-badge">{{ currentUser()?.role }}</div>
            </div>
          </div>

          <div *ngIf="profileMessage" class="alert" [ngClass]="{'alert-success': profileMessage.success, 'alert-error': !profileMessage.success}">
            <mat-icon>{{ profileMessage.success ? 'check_circle' : 'error' }}</mat-icon>
            {{ profileMessage.text }}
          </div>

          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="tpms-form">
            <div class="form-row">
              <div class="form-group">
                <label for="displayName">Display Name</label>
                <input 
                  type="text" 
                  id="displayName" 
                  formControlName="displayName" 
                  class="form-control"
                  [class.is-invalid]="profileForm.get('displayName')?.invalid && profileForm.get('displayName')?.touched"
                >
                <div class="invalid-feedback" *ngIf="profileForm.get('displayName')?.invalid && profileForm.get('displayName')?.touched">
                  Display name is required.
                </div>
              </div>
              <div class="form-group">
                <label for="username">Username</label>
                <input 
                  type="text" 
                  id="username" 
                  formControlName="username" 
                  class="form-control"
                  [class.is-invalid]="profileForm.get('username')?.invalid && profileForm.get('username')?.touched"
                >
                <div class="invalid-feedback" *ngIf="profileForm.get('username')?.invalid && profileForm.get('username')?.touched">
                  Username is required.
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn-primary" [disabled]="profileForm.invalid || profileSaving || !profileForm.dirty">
                <mat-icon *ngIf="!profileSaving">save</mat-icon>
                <span class="btn-spinner" *ngIf="profileSaving"></span>
                {{ profileSaving ? 'Saving...' : 'Save Profile' }}
              </button>
            </div>
          </form>
        </app-card>

        <!-- Change Password Section -->
        <app-card title="Change Password" class="profile-card">
          <div *ngIf="passwordMessage" class="alert" [ngClass]="{'alert-success': passwordMessage.success, 'alert-error': !passwordMessage.success}">
            <mat-icon>{{ passwordMessage.success ? 'check_circle' : 'error' }}</mat-icon>
            {{ passwordMessage.text }}
          </div>

          <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" class="tpms-form">
            <div class="form-group">
              <label for="currentPassword">Current Password</label>
              <input 
                type="password" 
                id="currentPassword" 
                formControlName="currentPassword" 
                class="form-control"
                [class.is-invalid]="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched"
              >
              <div class="invalid-feedback" *ngIf="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched">
                Current password is required.
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="newPassword">New Password</label>
                <input 
                  type="password" 
                  id="newPassword" 
                  formControlName="newPassword" 
                  class="form-control"
                  [class.is-invalid]="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched"
                >
                <div class="invalid-feedback" *ngIf="passwordForm.get('newPassword')?.errors?.['required'] && passwordForm.get('newPassword')?.touched">
                  New password is required.
                </div>
                <div class="invalid-feedback" *ngIf="passwordForm.get('newPassword')?.errors?.['minlength'] && passwordForm.get('newPassword')?.touched">
                  Password must be at least 6 characters.
                </div>
              </div>
              
              <div class="form-group">
                <label for="confirmPassword">Confirm New Password</label>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  formControlName="confirmPassword" 
                  class="form-control"
                  [class.is-invalid]="(passwordForm.get('confirmPassword')?.invalid || passwordForm.hasError('passwordMismatch')) && passwordForm.get('confirmPassword')?.touched"
                >
                <div class="invalid-feedback" *ngIf="passwordForm.get('confirmPassword')?.errors?.['required'] && passwordForm.get('confirmPassword')?.touched">
                  Please confirm your new password.
                </div>
                <div class="invalid-feedback" *ngIf="passwordForm.hasError('passwordMismatch') && passwordForm.get('confirmPassword')?.touched && !passwordForm.get('confirmPassword')?.errors?.['required']">
                  Passwords do not match.
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary" [disabled]="passwordForm.invalid || passwordSaving">
                <mat-icon *ngIf="!passwordSaving">lock_reset</mat-icon>
                <span class="btn-spinner" *ngIf="passwordSaving"></span>
                {{ passwordSaving ? 'Updating...' : 'Update Password' }}
              </button>
            </div>
          </form>
        </app-card>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      animation: fadeSlideUp 0.4s cubic-bezier(0.215, 0.61, 0.355, 1) both;
    }

    .profile-page {
      display: flex;
      flex-direction: column;
    }

    .profile-content {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      max-width: 760px;
      width: 100%;
      margin: 0 auto;
    }

    .profile-card {
      padding: var(--space-6);
    }

    /* ── Avatar Section ─────────────────────────────── */
    .avatar-section {
      display: flex;
      align-items: center;
      gap: var(--space-5);
      margin-bottom: var(--space-6);
      padding-bottom: var(--space-6);
      border-bottom: 1px solid var(--border-subtle);
    }

    .avatar-info {
      h3 {
        margin: 0 0 var(--space-1) 0;
        font-size: var(--text-xl);
        font-weight: var(--weight-medium);
        color: var(--text-primary);
        letter-spacing: -0.02em;
      }

      p {
        margin: 0 0 var(--space-2) 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }
    }

    .role-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      background: var(--primary-50);
      color: var(--primary);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      letter-spacing: 0.02em;
      text-transform: capitalize;
    }

    :host-context([data-theme="dark"]) .role-badge {
      background: rgba(99, 102, 241, 0.15);
      color: var(--primary-light);
    }

    /* ── Alert Messages ─────────────────────────────── */
    .alert {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      margin-bottom: var(--space-5);
      animation: fadeSlideUp 0.3s ease both;

      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }

    .alert-success {
      background: var(--success-light);
      color: var(--success-dark);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .alert-error {
      background: var(--error-light);
      color: var(--error-dark);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    /* ── Form ──────────────────────────────────────── */
    .tpms-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .form-row {
      display: flex;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .form-row > .form-group {
      flex: 1;
      min-width: 220px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .form-control {
      padding: 9px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      box-shadow: var(--shadow-xs);
      width: 100%;

      &:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: var(--shadow-glow);
      }

      &.is-invalid {
        border-color: var(--error);
      }
    }

    .invalid-feedback {
      font-size: var(--text-xs);
      color: var(--error);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
      margin-top: var(--space-2);
    }

    .btn-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;

  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  profileSaving = false;
  passwordSaving = false;

  profileMessage: { success: boolean; text: string } | null = null;
  passwordMessage: { success: boolean; text: string } | null = null;

  ngOnInit(): void {
    const user = this.currentUser();
    
    this.profileForm = this.fb.group({
      displayName: [user?.displayName || '', [Validators.required]],
      username: [user?.username || '', [Validators.required]]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: passwordMatchValidator });
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) return;
    
    this.profileSaving = true;
    this.profileMessage = null;

    try {
      const result = await this.auth.updateProfile(this.profileForm.value);
      if (result.success) {
        this.profileMessage = { success: true, text: 'Profile updated successfully.' };
        this.profileForm.markAsPristine();
      } else {
        this.profileMessage = { success: false, text: result.error || 'Failed to update profile.' };
      }
    } catch (e) {
      this.profileMessage = { success: false, text: 'An unexpected error occurred.' };
    } finally {
      this.profileSaving = false;
      
      if (this.profileMessage?.success) {
        setTimeout(() => this.profileMessage = null, 3000);
      }
    }
  }

  async savePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;
    
    this.passwordSaving = true;
    this.passwordMessage = null;

    try {
      const { currentPassword, newPassword } = this.passwordForm.value;
      const result = await this.auth.updatePassword(currentPassword, newPassword);
      
      if (result.success) {
        this.passwordMessage = { success: true, text: 'Password changed successfully.' };
        this.passwordForm.reset();
      } else {
        this.passwordMessage = { success: false, text: result.error || 'Failed to change password.' };
      }
    } catch (e) {
      this.passwordMessage = { success: false, text: 'An unexpected error occurred.' };
    } finally {
      this.passwordSaving = false;

      if (this.passwordMessage?.success) {
        setTimeout(() => this.passwordMessage = null, 3000);
      }
    }
  }
}
