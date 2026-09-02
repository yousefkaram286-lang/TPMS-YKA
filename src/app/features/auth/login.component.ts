// ============================================================
// TPMS — Login Component
// ============================================================
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule],
  template: `
    <div class="login-page">
      <div class="aurora aurora--1"></div>
      <div class="aurora aurora--2"></div>
      <div class="aurora aurora--3"></div>

      <div class="login-split">

        <!-- Left Side: Illustration / Branding -->
        <div class="login-banner">
          <div class="login-banner__overlay"></div>
          <div class="login-banner__content">
            <div class="login-banner__logo animate-scale-bounce">
              <mat-icon>precision_manufacturing</mat-icon>
            </div>
            <h1 class="login-banner__title text-gradient animate-fade-left">TPMS</h1>
            <p class="login-banner__subtitle animate-fade-left stagger-1">Production Management System</p>
            <div class="login-banner__features">
              <div class="feature-item animate-fade-left stagger-2">
                <span class="feature-item__icon"><mat-icon>bolt</mat-icon></span>
                Real-time tracking
              </div>
              <div class="feature-item animate-fade-left stagger-3">
                <span class="feature-item__icon"><mat-icon>verified</mat-icon></span>
                Quality control
              </div>
              <div class="feature-item animate-fade-left stagger-4">
                <span class="feature-item__icon"><mat-icon>insights</mat-icon></span>
                Resource optimization
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side: Form -->
        <div class="login-form-container page-content">
          <div class="login-form-wrapper glass animate-scale-in">
            <div class="login-header">
              <div class="login-header__badge">
                <mat-icon>precision_manufacturing</mat-icon>
              </div>
              <h2 class="text-gradient">Welcome back</h2>
              <p>Please enter your details to sign in.</p>
            </div>

            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">

              <!-- Error Alert -->
              <div class="alert alert-error animate-slide-down" *ngIf="errorMessage()">
                <mat-icon>error_outline</mat-icon>
                <span>{{ errorMessage() }}</span>
              </div>

              <!-- Username -->
              <div class="form-group">
                <div class="form-field input-icon-wrapper" [class.has-value]="loginForm.get('username')?.value">
                  <mat-icon class="input-icon">person_outline</mat-icon>
                  <input
                    type="text"
                    id="username"
                    formControlName="username"
                    class="form-control"
                    placeholder=" "
                    autocomplete="email"
                  />
                  <label for="username" class="form-label">Email</label>
                </div>
                <div class="form-error" *ngIf="isFieldInvalid('username')">
                  <mat-icon>error</mat-icon> Email is required
                </div>
              </div>

              <!-- Password -->
              <div class="form-group">
                <div class="form-field input-icon-wrapper" [class.has-value]="loginForm.get('password')?.value">
                  <mat-icon class="input-icon">lock_outline</mat-icon>
                  <input
                    [type]="showPassword ? 'text' : 'password'"
                    id="password"
                    formControlName="password"
                    class="form-control has-right-icon"
                    placeholder=" "
                    autocomplete="current-password"
                  />
                  <label for="password" class="form-label">Password</label>
                  <button
                    type="button"
                    class="input-icon-right"
                    (click)="showPassword = !showPassword"
                    [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                  >
                    <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </div>
                <div class="form-error" *ngIf="isFieldInvalid('password')">
                  <mat-icon>error</mat-icon> Password is required
                </div>
              </div>

              <!-- Remember Me & Forgot -->
              <div class="login-form-options">
                <label class="form-checkbox">
                  <input type="checkbox" formControlName="rememberMe" />
                  <span>Remember me</span>
                </label>
                <a routerLink="/forgot-password" class="forgot-link">Forgot password?</a>
              </div>

              <!-- Submit -->
              <button
                type="submit"
                class="btn-primary btn-lg btn-full"
                [disabled]="loginForm.invalid || isLoading()"
                [class.btn-loading]="isLoading()"
              >
                <span *ngIf="!isLoading()">Sign In</span>
                <span *ngIf="isLoading()" class="btn-spinner"></span>
              </button>
            </form>

            <div class="login-footer">
              <!-- <p>Demo Accounts:</p> -->
              <div class="demo-accounts">
                <!-- <span class="badge badge--primary">admin / admin123</span>
                <span class="badge badge--success">user / user123</span> -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    username:   ['', Validators.required],
    password:   ['', Validators.required],
    rememberMe: [false],
  });

  showPassword = false;
  isLoading    = this.auth.isLoading;
  errorMessage = signal<string>('');

  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    
    const { username, password, rememberMe } = this.loginForm.value;

    const res = await this.auth.login({
      username: username!,
      password: password!,
      rememberMe: rememberMe ?? false
    });

    if (res.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set(res.error || 'Login failed.');
    }
  }
}
