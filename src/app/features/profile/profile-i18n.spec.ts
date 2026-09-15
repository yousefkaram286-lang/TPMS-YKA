import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { ForgotPasswordComponent } from '../auth/forgot-password.component';
import { LoginComponent } from '../auth/login.component';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { LANGUAGE_STORAGE_KEY } from '../../core/i18n';
import { authErrorKey } from '../../core/i18n/auth-error-keys';

describe('Final auth/profile i18n', () => {
  let translation: TranslationService;
  let auth: any;
  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    auth = {
      currentUser: signal({ displayName: 'سارة Test', username: 'sara', email: 'sara@example.test', role: 'Admin' }),
      isLoading: signal(false),
      updateProfile: jasmine.createSpy().and.resolveTo({ success: true }),
      updatePassword: jasmine.createSpy().and.resolveTo({ success: false, error: 'Incorrect current password.' }),
      lookupEmailForReset: jasmine.createSpy().and.resolveTo({ success: true }),
      resetPassword: jasmine.createSpy().and.resolveTo({ success: true }),
      login: jasmine.createSpy().and.resolveTo({ success: false, error: 'Invalid login credentials' })
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
    translation = TestBed.inject(TranslationService);
  });
  afterEach(() => { translation.setLanguage('en'); localStorage.removeItem(LANGUAGE_STORAGE_KEY); });

  it('switches profile labels live while preserving names and email', () => {
    const f = TestBed.createComponent(ProfileComponent); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('My Profile');
    translation.setLanguage('ar'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('ملفي الشخصي');
    expect(f.nativeElement.textContent).toContain('سارة Test');
    expect(f.nativeElement.textContent).toContain('sara@example.test');
    expect(f.nativeElement.textContent).toContain('مدير');
    expect(f.nativeElement.textContent).not.toContain('Confirm New Password');
  });
  it('preserves password validators and exact auth arguments', async () => {
    const f = TestBed.createComponent(ProfileComponent); f.detectChanges();
    f.componentInstance.passwordForm.setValue({currentPassword:'old123',newPassword:'123',confirmPassword:'other'});
    expect(f.componentInstance.passwordForm.invalid).toBeTrue();
    await f.componentInstance.savePassword(); expect(auth.updatePassword).not.toHaveBeenCalled();
    f.componentInstance.passwordForm.setValue({currentPassword:'old123',newPassword:'new123',confirmPassword:'new123'});
    await f.componentInstance.savePassword();
    expect(auth.updatePassword).toHaveBeenCalledOnceWith('old123','new123');
    translation.setLanguage('ar'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('كلمة المرور الحالية غير صحيحة.');
  });
  it('keeps email-reset success flow and switches its displayed result', async () => {
    const f = TestBed.createComponent(ForgotPasswordComponent); f.detectChanges();
    f.componentInstance.emailForm.setValue({email:'sara@example.test'});
    await f.componentInstance.submitEmail();
    expect(auth.lookupEmailForReset).toHaveBeenCalledOnceWith('sara@example.test');
    expect(f.componentInstance.step()).toBe('success');
    translation.setLanguage('ar'); f.detectChanges();
    expect(f.nativeElement.querySelector('.tpms-dir').getAttribute('dir')).toBe('rtl');
    expect(f.nativeElement.textContent).toContain('تحقق من بريدك الإلكتروني');
  });
  it('translates the existing reset step and preserves mismatch validation', () => {
    const f = TestBed.createComponent(ForgotPasswordComponent);
    f.componentInstance.step.set('reset'); translation.setLanguage('ar'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('تأكيد كلمة المرور الجديدة');
    f.componentInstance.resetForm.setValue({newPassword:'123456',confirmPassword:'654321'});
    expect(f.componentInstance.resetForm.hasError('passwordMismatch')).toBeTrue();
    expect(f.nativeElement.querySelector('#fp-new-password').getAttribute('dir')).toBe('ltr');
  });
  it('translates login errors without changing credentials', async () => {
    const f = TestBed.createComponent(LoginComponent); f.detectChanges();
    f.componentInstance.loginForm.setValue({username:'sara@example.test',password:'123456',rememberMe:true});
    await f.componentInstance.onSubmit(); translation.setLanguage('ar'); f.detectChanges();
    expect(auth.login).toHaveBeenCalledOnceWith({username:'sara@example.test',password:'123456',rememberMe:true});
    expect(f.nativeElement.textContent).toContain('بيانات تسجيل الدخول غير صحيحة');
  });
  it('preserves unknown server diagnostics verbatim', () => {
    expect(authErrorKey('Server detail 123')).toBe('Server detail 123');
    expect(authErrorKey(undefined)).toBeUndefined();
  });
});
