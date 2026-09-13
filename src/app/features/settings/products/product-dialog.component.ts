import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-product-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-wrapper tpms-dir" [attr.dir]="translation.dir()">
      <div class="dialog-header">
        <h2 mat-dialog-title>{{ isEditMode ? translation.translate('settings.products.dialog.title.edit') : translation.translate('settings.products.dialog.title.add') }}</h2>
        <button mat-icon-button (click)="close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <form [formGroup]="productForm" class="tpms-form">
          <div class="form-group">
            <label for="name">{{ translation.translate('settings.products.dialog.name') }}</label>
            <input
              type="text"
              id="name"
              formControlName="name"
              class="form-control"
              [class.is-invalid]="productForm.get('name')?.invalid && productForm.get('name')?.touched"
              [placeholder]="translation.translate('settings.products.dialog.name.placeholder')"
            >
            <div class="invalid-feedback" *ngIf="productForm.get('name')?.invalid && productForm.get('name')?.touched">
              {{ translation.translate('settings.products.dialog.name.error') }}
            </div>
          </div>

          <div class="form-group">
            <label for="type">{{ translation.translate('settings.products.dialog.type') }}</label>
            <select
              id="type"
              formControlName="type"
              class="form-control"
            >
              <option value="">{{ translation.translate('settings.products.dialog.type.placeholder') }}</option>
              <option value="BLOCK">{{ translation.translate('settings.products.dialog.type.block') }}</option>
              <option value="SOLID">{{ translation.translate('settings.products.dialog.type.solid') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label for="nameAr">{{ translation.translate('settings.products.dialog.nameAr') }}</label>
            <input
              type="text"
              id="nameAr"
              formControlName="nameAr"
              class="form-control"
              [placeholder]="translation.translate('settings.products.dialog.nameAr.placeholder')"
            >
          </div>

          <div class="form-group">
            <label for="dimensions">{{ translation.translate('settings.products.dialog.dimensions') }}</label>
            <input
              type="text"
              id="dimensions"
              formControlName="dimensions"
              class="form-control"
              [placeholder]="translation.translate('settings.products.dialog.dimensions.placeholder')"
            >
          </div>

          <div class="form-group">
            <label for="densityKgPerM3">{{ translation.translate('settings.products.dialog.density') }}</label>
            <input
              type="number"
              id="densityKgPerM3"
              formControlName="densityKgPerM3"
              class="form-control"
              [placeholder]="translation.translate('settings.products.dialog.density.placeholder')"
            >
          </div>

          <div class="form-group">
            <label for="piecesPerPress">{{ translation.translate('settings.products.dialog.piecesPerPress') }}</label>
            <input
              type="number"
              id="piecesPerPress"
              formControlName="piecesPerPress"
              class="form-control"
              [class.is-invalid]="productForm.get('piecesPerPress')?.invalid && productForm.get('piecesPerPress')?.touched"
              [placeholder]="translation.translate('settings.products.dialog.piecesPerPress.placeholder')"
            >
            <div class="invalid-feedback" *ngIf="productForm.get('piecesPerPress')?.invalid && productForm.get('piecesPerPress')?.touched">
              {{ translation.translate('settings.products.dialog.piecesPerPress.error') }}
            </div>
          </div>

          <div class="form-group">
            <label for="productArea">{{ translation.translate('settings.products.dialog.productArea') }}</label>
            <input
              type="number"
              id="productArea"
              formControlName="productArea"
              class="form-control"
              [class.is-invalid]="productForm.get('productArea')?.invalid && productForm.get('productArea')?.touched"
              [placeholder]="translation.translate('settings.products.dialog.productArea.placeholder')"
            >
            <div class="invalid-feedback" *ngIf="productForm.get('productArea')?.invalid && productForm.get('productArea')?.touched">
              {{ translation.translate('settings.products.dialog.productArea.error') }}
            </div>
          </div>

          <div class="form-group">
            <label for="standardStrength">{{ translation.translate('settings.products.dialog.standardStrength') }}</label>
            <input
              type="number"
              id="standardStrength"
              formControlName="standardStrength"
              class="form-control"
              [class.is-invalid]="productForm.get('standardStrength')?.invalid && productForm.get('standardStrength')?.touched"
              [placeholder]="translation.translate('settings.products.dialog.standardStrength.placeholder')"
            >
            <div class="invalid-feedback" *ngIf="productForm.get('standardStrength')?.invalid && productForm.get('standardStrength')?.touched">
              {{ translation.translate('settings.products.dialog.standardStrength.error') }}
            </div>
          </div>

          <div class="form-group">
            <label for="standardHeight">{{ translation.translate('settings.products.dialog.standardHeight') }}</label>
            <input
              type="number"
              id="standardHeight"
              formControlName="standardHeight"
              class="form-control"
              [class.is-invalid]="productForm.get('standardHeight')?.invalid && productForm.get('standardHeight')?.touched"
              [placeholder]="translation.translate('settings.products.dialog.standardHeight.placeholder')"
            >
            <div class="invalid-feedback" *ngIf="productForm.get('standardHeight')?.invalid && productForm.get('standardHeight')?.touched">
              {{ translation.translate('settings.products.dialog.standardHeight.error') }}
            </div>
          </div>

          <div class="form-group">
            <label for="standardWeight">{{ translation.translate('settings.products.dialog.standardWeight') }}</label>
            <input
              type="number"
              id="standardWeight"
              formControlName="standardWeight"
              class="form-control"
              [class.is-invalid]="productForm.get('standardWeight')?.invalid && productForm.get('standardWeight')?.touched"
              [placeholder]="translation.translate('settings.products.dialog.standardWeight.placeholder')"
            >
            <div class="invalid-feedback" *ngIf="productForm.get('standardWeight')?.invalid && productForm.get('standardWeight')?.touched">
              {{ translation.translate('settings.products.dialog.standardWeight.error') }}
            </div>
          </div>

          <div class="form-group toggle-group">
            <label class="toggle-label">
              <span>{{ translation.translate('settings.products.dialog.active') }}</span>
              <div class="toggle-switch">
                <input type="checkbox" formControlName="active">
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <div class="error-banner" *ngIf="errorMessage">
          <mat-icon>error_outline</mat-icon>
          <span>{{ errorMessage }}</span>
        </div>
        <div class="dialog-buttons">
          <button class="btn-secondary btn-sm" (click)="close()" [disabled]="saving">{{ translation.translate('settings.products.dialog.cancel') }}</button>
          <button class="btn-primary btn-sm" (click)="save()" [disabled]="productForm.invalid || saving">
            {{ saving ? translation.translate('settings.products.dialog.saving') : translation.translate('settings.products.dialog.save') }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-4) var(--space-6);
      border-bottom: 1px solid var(--border-subtle);
    }

    .dialog-header h2 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--weight-semibold);
    }

    .close-btn {
      color: var(--text-muted);
    }

    mat-dialog-content {
      padding: var(--space-6) !important;
    }

    mat-dialog-actions {
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border-subtle);
      margin: 0;
    }

    .tpms-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .form-group label {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--text-secondary);
    }

    .form-control {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      color: var(--text-primary);
      font-size: var(--text-sm);
      transition: border-color 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: var(--accent);
    }

    .form-control.is-invalid {
      border-color: var(--error);
    }

    .invalid-feedback {
      font-size: var(--text-xs);
      color: var(--error);
      margin-top: 2px;
    }

    .toggle-group {
      margin-top: var(--space-2);
    }

    .toggle-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--border);
      transition: .4s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--success);
    }

    input:checked + .slider:before {
      transform: translateX(20px);
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      background: var(--error-light, #fff0f0);
      border: 1px solid var(--error, #e53935);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      color: var(--error, #e53935);
      font-size: var(--text-sm);
      width: 100%;
      margin-bottom: var(--space-2);
    }

    .error-banner mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    mat-dialog-actions {
      flex-direction: column;
      align-items: stretch !important;
    }

    .dialog-buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      width: 100%;
    }

    .tpms-dir[dir="rtl"] .dialog-header {
      flex-direction: row-reverse;
    }

    .tpms-dir[dir="rtl"] mat-dialog-content {
      text-align: right;
    }

    .tpms-dir[dir="rtl"] .form-group label {
      text-align: right;
    }

    .tpms-dir[dir="rtl"] .dialog-buttons {
      flex-direction: row-reverse;
    }

    .tpms-dir[dir="rtl"] input,
    .tpms-dir[dir="rtl"] select {
      text-align: right;
    }
  `]
})
export class ProductDialogComponent implements OnInit {
  readonly translation = inject(TranslationService);
  productForm: FormGroup;
  isEditMode = false;
  saving = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProductDialogComponent>,
    private productService: ProductService,
    @Inject(MAT_DIALOG_DATA) public data: Product | null
  ) {
    this.isEditMode = !!data;

    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      type: [''],
      nameAr: ['', [Validators.maxLength(50)]],
      dimensions: ['', [Validators.maxLength(100)]],
      densityKgPerM3: [null, [Validators.min(0.01)]],
      piecesPerPress: [null, [Validators.min(0.01)]],
      productArea: [null, [Validators.min(0.01)]],
      standardStrength: [null, [Validators.required, Validators.min(0.01)]],
      standardHeight: [null, [Validators.min(0.01)]],
      standardWeight: [null, [Validators.min(0.01)]],
      active: [true]
    });
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data) {
      this.productForm.patchValue({
        name: this.data.name,
        type: this.data.type ?? '',
        nameAr: this.data.nameAr ?? '',
        dimensions: this.data.dimensions ?? '',
        densityKgPerM3: this.data.densityKgPerM3 ?? null,
        piecesPerPress: this.data.piecesPerPress ?? null,
        productArea: this.data.productArea ?? null,
        standardStrength: this.data.standardStrength,
        standardHeight: this.data.standardHeight ?? null,
        standardWeight: this.data.standardWeight ?? null,
        active: this.data.active
      });
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const formValue = this.productForm.value;

    // Trim text
    formValue.name = formValue.name.trim();
    if (formValue.type === '') { formValue.type = undefined; }
    if (formValue.nameAr) { formValue.nameAr = formValue.nameAr.trim(); }
    if (formValue.dimensions) { formValue.dimensions = formValue.dimensions.trim(); }

    if (this.isEditMode && this.data) {
      const updatedProduct: Product = {
        ...this.data,
        ...formValue,
        updatedAt: new Date().toISOString()
      };

      this.productService.update(updatedProduct).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error('[ProductDialog] Update failed:', err);
          this.saving = false;
          this.errorMessage = err?.message || this.translation.translate('settings.products.dialog.saveError');
        }
      });
    } else {
      const newProduct: Product = {
        id: crypto.randomUUID(),
        ...formValue,
        createdAt: new Date().toISOString()
      };

      this.productService.create(newProduct).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error('[ProductDialog] Create failed:', err);
          this.saving = false;
          this.errorMessage = err?.message || this.translation.translate('settings.products.dialog.saveError');
        }
      });
    }
  }
}
