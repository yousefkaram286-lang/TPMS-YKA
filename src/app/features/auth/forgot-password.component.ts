// ============================================================
// TPMS — Forgot Password Component
// ============================================================
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPass    = control.get('newPassword')?.value;
  const confirmPass = control.get('confirmPassword')?.value;
  if (newPass && confirmPass && newPass !== confirmPass) {
    return { passwordMismatch: true };
  }
  return null;
}

type Step = 'email' | 'reset' | 'success';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule],
  template: `
    <div class="login-page">
      <div class="login-split">

        <!-- Left banner (identical to login) -->
        <div class="login-banner">
          <div class="login-banner__overlay"></div>
          <div class="login-banner__content">
            <div class="login-banner__logo">
              <mat-icon>precision_manufacturing</mat-icon>
            </div>
            <h1 class="login-banner__title">TPMS</h1>
            <p class="login-banner__subtitle">Production Management System</p>
            <div class="login-banner__features">
              <div class="feature-item"><mat-icon>lock_reset</mat-icon> Secure password reset</div>
              <div class="feature-item"><mat-icon>check_circle</mat-icon> Instant access restoration</div>
              <div class="feature-item"><mat-icon>verified_user</mat-icon> Identity verification</div>
            </div>
          </div>
        </div>

        <!-- Right: multi-step form -->
        <div class="login-form-container page-content">
          <div class="login-form-wrapper">

            <!-- ── Step 1: Enter Email ── -->
            <ng-container *ngIf="step() === 'email'">
              <div class="fp-back">
                <a routerLink="/login" class="back-link">
                  <mat-icon>arrow_back</mat-icon>
                  Back to Sign In
                </a>
              </div>

              <div class="login-header">
                <div class="fp-icon-wrap">
                  <mat-icon class="fp-icon">lock_reset</mat-icon>
                </div>
                <h2>Forgot Password?</h2>
                <p>Enter the email address associated with your account and we'll verify it.</p>
              </div>

              <div class="alert alert-error" *ngIf="emailError()">
                <mat-icon>error_outline</mat-icon>
                <span>{{ emailError() }}</span>
              </div>

              <form [formGroup]="emailForm" (ngSubmit)="submitEmail()" class="login-form">
                <div class="form-group">
                  <div class="form-field input-icon-wrapper" [class.has-value]="emailForm.get('email')?.value">
                    <mat-icon class="input-icon">email</mat-icon>
                    <input
                      type="email"
                      id="fp-email"
                      formControlName="email"
                      class="form-control"
                      placeholder=" "
                      autocomplete="email"
                    />
                    <label for="fp-email" class="form-label">Email Address</label>
                  </div>
                  <div class="form-error" *ngIf="isEmailFieldInvalid('email')">
                    <mat-icon>error</mat-icon>
                    <span *ngIf="emailForm.get('email')?.errors?.['required']">Email is required.</span>
                    <span *ngIf="emailForm.get('email')?.errors?.['email']">Please enter a valid email address.</span>
                  </div>
                </div>

                <button
                  type="submit"
                  class="btn-primary btn-lg btn-full"
                  [disabled]="emailForm.invalid || emailLoading()"
                  [class.btn-loading]="emailLoading()"
                >
                  <span *ngIf="!emailLoading()">Continue</span>
                  <span *ngIf="emailLoading()" class="btn-spinner"></span>
                </button>
              </form>
            </ng-container>

            <!-- ── Step 2: Set New Password ── -->
            <ng-container *ngIf="step() === 'reset'">
              <div class="fp-back">
                <a href="javascript:void(0)" class="back-link" (click)="goBackToEmail()">
                  <mat-icon>arrow_back</mat-icon>
                  Change Email
                </a>
              </div>

              <div class="login-header">
                <div class="fp-icon-wrap fp-icon-wrap--success">
                  <mat-icon class="fp-icon">key</mat-icon>
                </div>
                <h2>Set New Password</h2>
                <p>Create a strong password for <strong>{{ verifiedEmail() }}</strong></p>
              </div>

              <div class="alert alert-error" *ngIf="resetError()">
                <mat-icon>error_outline</mat-icon>
                <span>{{ resetError() }}</span>
              </div>

              <form [formGroup]="resetForm" (ngSubmit)="submitReset()" class="login-form">
                <!-- New Password -->
                <div class="form-group">
                  <div class="form-field input-icon-wrapper" [class.has-value]="resetForm.get('newPassword')?.value">
                    <mat-icon class="input-icon">lock_outline</mat-icon>
                    <input
                      [type]="showNew ? 'text' : 'password'"
                      id="fp-new-password"
                      formControlName="newPassword"
                      class="form-control has-right-icon"
                      placeholder=" "
                      autocomplete="new-password"
                    />
                    <label for="fp-new-password" class="form-label">New Password</label>
                    <button type="button" class="input-icon-right" (click)="showNew = !showNew">
                      <mat-icon>{{ showNew ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </div>
                  <div class="form-error" *ngIf="isResetFieldInvalid('newPassword')">
                    <mat-icon>error</mat-icon>
                    <span *ngIf="resetForm.get('newPassword')?.errors?.['required']">Password is required.</span>
                    <span *ngIf="resetForm.get('newPassword')?.errors?.['minlength']">Must be at least 6 characters.</span>
                  </div>
                </div>

                <!-- Confirm Password -->
                <div class="form-group">
                  <div class="form-field input-icon-wrapper" [class.has-value]="resetForm.get('confirmPassword')?.value">
                    <mat-icon class="input-icon">lock_outline</mat-icon>
                    <input
                      [type]="showConfirm ? 'text' : 'password'"
                      id="fp-confirm-password"
                      formControlName="confirmPassword"
                      class="form-control has-right-icon"
                      placeholder=" "
                      autocomplete="new-password"
                    />
                    <label for="fp-confirm-password" class="form-label">Confirm New Password</label>
                    <button type="button" class="input-icon-right" (click)="showConfirm = !showConfirm">
                      <mat-icon>{{ showConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </div>
                  <div class="form-error" *ngIf="isResetFieldInvalid('confirmPassword') || (resetForm.hasError('passwordMismatch') && resetForm.get('confirmPassword')?.touched)">
                    <mat-icon>error</mat-icon>
                    <span *ngIf="resetForm.get('confirmPassword')?.errors?.['required']">Please confirm your password.</span>
                    <span *ngIf="resetForm.hasError('passwordMismatch') && !resetForm.get('confirmPassword')?.errors?.['required']">Passwords do not match.</span>
                  </div>
                </div>

                <!-- Password requirements hint -->
                <div class="fp-hint">
                  <mat-icon>info_outline</mat-icon>
                  Minimum 6 characters required.
                </div>

                <button
                  type="submit"
                  class="btn-primary btn-lg btn-full"
                  [disabled]="resetForm.invalid || resetLoading()"
                  [class.btn-loading]="resetLoading()"
                >
                  <span *ngIf="!resetLoading()">Reset Password</span>
                  <span *ngIf="resetLoading()" class="btn-spinner"></span>
                </button>
              </form>
            </ng-container>

            <!-- ── Step 3: Success ── -->
            <ng-container *ngIf="step() === 'success'">
              <div class="fp-success">
                <div class="fp-success__icon">
                  <mat-icon>check_circle</mat-icon>
                </div>
                <h2>Check Your Email</h2>
                <p>If an account exists for that email, we've sent you a password reset link.</p>
                <a routerLink="/login" class="btn-primary btn-lg btn-full fp-success__btn">
                  <mat-icon>login</mat-icon>
                  Back to Sign In
                </a>
              </div>
            </ng-container>

          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../auth/login.component.scss'],
  styles: [`
    .fp-back {
      margin-bottom: var(--space-6);
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.2s;
      cursor: pointer;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &:hover { color: var(--primary); }
    }

    .fp-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: var(--radius-xl);
      background: var(--primary-50);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto var(--space-5);

      &--success {
        background: var(--success-light);
        .fp-icon { color: var(--success); }
      }
    }

    [data-theme="dark"] .fp-icon-wrap {
      background: var(--primary-100);
      &--success { background: var(--success-light); }
    }

    .fp-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--primary);
    }

    .fp-hint {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      margin-top: calc(-1 * var(--space-2));

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .alert-success {
      background: var(--success-light);
      color: var(--success-dark);
      border: 1px solid rgba(5, 150, 105, 0.2);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-6);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);

      mat-icon { color: var(--success); }
    }

    .fp-success {
      text-align: center;
      padding: var(--space-4) 0;

      &__icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: var(--success-light);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--space-6);

        mat-icon {
          font-size: 40px;
          width: 40px;
          height: 40px;
          color: var(--success);
        }
      }

      h2 {
        font-size: var(--text-3xl);
        font-weight: var(--weight-bold);
        color: var(--text-primary);
        margin: 0 0 var(--space-3);
      }

      p {
        color: var(--text-secondary);
        margin: 0 0 var(--space-8);
        line-height: var(--leading-relaxed);
      }

      &__btn {
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }
  `]
})
export class ForgotPasswordComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  step = signal<Step>('email');
  verifiedEmail = signal('');
  verifiedUserId = signal('');

  emailError  = signal('');
  resetError  = signal('');
  emailLoading = signal(false);
  resetLoading = signal(false);

  showNew     = false;
  showConfirm = false;

  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  resetForm = this.fb.group({
    newPassword:     ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  // ── Helpers ──────────────────────────────────────────────
  isEmailFieldInvalid(field: string): boolean {
    const c = this.emailForm.get(field);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  isResetFieldInvalid(field: string): boolean {
    const c = this.resetForm.get(field);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  goBackToEmail(): void {
    this.resetForm.reset();
    this.resetError.set('');
    this.step.set('email');
  }

  // ── Step 1: verify email ──────────────────────────────────
  async submitEmail(): Promise<void> {
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }

    this.emailError.set('');
    this.emailLoading.set(true);

    try {
      const email = this.emailForm.value.email!;
      const result = await this.auth.lookupEmailForReset(email);

      if (result.success) {
        this.verifiedEmail.set(email);
        this.step.set('success');
      } else {
        this.emailError.set(result.error || 'Email lookup failed.');
      }
    } catch {
      this.emailError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.emailLoading.set(false);
    }
  }

  // ── Step 2: reset password ────────────────────────────────
  async submitReset(): Promise<void> {
    if (this.resetForm.invalid) { this.resetForm.markAllAsTouched(); return; }

    this.resetError.set('');
    this.resetLoading.set(true);

    try {
      const newPassword = this.resetForm.value.newPassword!;
      const result = await this.auth.resetPassword(this.verifiedUserId(), newPassword);

      if (result.success) {
        this.step.set('success');
      } else {
        this.resetError.set(result.error || 'Failed to reset password. Please try again.');
      }
    } catch {
      this.resetError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.resetLoading.set(false);
    }
  }
}
