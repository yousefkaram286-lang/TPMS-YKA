// ============================================================
// TPMS — Login Component
// ------------------------------------------------------------
// Translated page: its root carries the `.tpms-dir` direction
// container whose dir follows the UI language (RTL in Arabic).
// Directional CSS is scoped to `.tpms-dir[dir="rtl"]`.
// ============================================================
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Dir } from '@angular/cdk/bidi';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule, Dir, LanguageSwitcherComponent],
  template: `
    <div class="login-page tpms-dir" [dir]="translation.dir()">
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
            <h1 class="login-banner__title text-gradient animate-fade-left">{{ translation.translate('app.name') }}</h1>
            <p class="login-banner__subtitle animate-fade-left stagger-1">{{ translation.translate('app.fullName') }}</p>
            <div class="login-banner__features">
              <div class="feature-item animate-fade-left stagger-2">
                <span class="feature-item__icon"><mat-icon>bolt</mat-icon></span>
                {{ translation.translate('auth.login.feature.tracking') }}
              </div>
              <div class="feature-item animate-fade-left stagger-3">
                <span class="feature-item__icon"><mat-icon>verified</mat-icon></span>
                {{ translation.translate('auth.login.feature.quality') }}
              </div>
              <div class="feature-item animate-fade-left stagger-4">
                <span class="feature-item__icon"><mat-icon>insights</mat-icon></span>
                {{ translation.translate('auth.login.feature.resource') }}
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
              <div class="login-header__actions">
                <app-language-switcher></app-language-switcher>
              </div>
              <h2 class="text-gradient">{{ translation.translate('auth.login.welcome') }}</h2>
              <p>{{ translation.translate('auth.login.subtitle') }}</p>
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
                  <label for="username" class="form-label">{{ translation.translate('auth.login.email') }}</label>
                </div>
                <div class="form-error" *ngIf="isFieldInvalid('username')">
                  <mat-icon>error</mat-icon> {{ translation.translate('auth.login.error.emailRequired') }}
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
                  <label for="password" class="form-label">{{ translation.translate('auth.login.password') }}</label>
                  <button
                    type="button"
                    class="input-icon-right"
                    (click)="showPassword = !showPassword"
                    [attr.aria-label]="translation.translate(showPassword ? 'header.hidePassword' : 'header.showPassword')"
                  >
                    <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </div>
                <div class="form-error" *ngIf="isFieldInvalid('password')">
                  <mat-icon>error</mat-icon> {{ translation.translate('auth.login.error.passwordRequired') }}
                </div>
              </div>

              <!-- Remember Me & Forgot -->
              <div class="login-form-options">
                <label class="form-checkbox">
                  <input type="checkbox" formControlName="rememberMe" />
                  <span>{{ translation.translate('auth.login.rememberMe') }}</span>
                </label>
                <a routerLink="/forgot-password" class="forgot-link">{{ translation.translate('auth.login.forgotPassword') }}</a>
              </div>

              <!-- Submit -->
              <button
                type="submit"
                class="btn-primary btn-lg btn-full"
                [disabled]="loginForm.invalid || isLoading()"
                [class.btn-loading]="isLoading()"
              >
                <span *ngIf="!isLoading()">{{ translation.translate('auth.login.signIn') }}</span>
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
  readonly translation = inject(TranslationService);

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
      this.errorMessage.set(res.error || this.translation.translate('auth.login.failed'));
    }
  }
}
