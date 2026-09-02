import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';

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
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ isEditMode ? 'Edit Product' : 'Add Product' }}</h2>
      <button mat-icon-button (click)="close()" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <form [formGroup]="productForm" class="tpms-form">
        <div class="form-group">
          <label for="name">Product Name</label>
          <input 
            type="text" 
            id="name" 
            formControlName="name" 
            class="form-control" 
            [class.is-invalid]="productForm.get('name')?.invalid && productForm.get('name')?.touched"
            placeholder="e.g. Block 25"
          >
          <div class="invalid-feedback" *ngIf="productForm.get('name')?.invalid && productForm.get('name')?.touched">
            Product Name is required and must be between 2 and 50 characters.
          </div>
        </div>

        <div class="form-group">
          <label for="type">Type / Family</label>
          <select 
            id="type" 
            formControlName="type" 
            class="form-control"
          >
            <option value="">Not configured</option>
            <option value="BLOCK">BLOCK (بلوك)</option>
            <option value="SOLID">SOLID (مصمت)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="nameAr">Arabic Name</label>
          <input 
            type="text" 
            id="nameAr" 
            formControlName="nameAr" 
            class="form-control"
            placeholder="e.g. بلوك 25 (optional)"
          >
        </div>

        <div class="form-group">
          <label for="dimensions">Dimensions</label>
          <input 
            type="text" 
            id="dimensions" 
            formControlName="dimensions" 
            class="form-control"
            placeholder="e.g. 40 × 20 × 25 cm (optional)"
          >
        </div>

        <div class="form-group">
          <label for="densityKgPerM3">Density (kg/m³)</label>
          <input 
            type="number" 
            id="densityKgPerM3" 
            formControlName="densityKgPerM3" 
            class="form-control"
            placeholder="e.g. 1200 (optional)"
          >
        </div>

        <div class="form-group">
          <label for="piecesPerPress">Pieces Per Press</label>
          <input 
            type="number" 
            id="piecesPerPress" 
            formControlName="piecesPerPress" 
            class="form-control"
            [class.is-invalid]="productForm.get('piecesPerPress')?.invalid && productForm.get('piecesPerPress')?.touched"
            placeholder="e.g. 10.5"
          >
          <div class="invalid-feedback" *ngIf="productForm.get('piecesPerPress')?.invalid && productForm.get('piecesPerPress')?.touched">
            Must be greater than 0 when provided.
          </div>
        </div>

        <div class="form-group">
          <label for="productArea">Product Area</label>
          <input 
            type="number" 
            id="productArea" 
            formControlName="productArea" 
            class="form-control"
            [class.is-invalid]="productForm.get('productArea')?.invalid && productForm.get('productArea')?.touched"
            placeholder="e.g. 0.1"
          >
          <div class="invalid-feedback" *ngIf="productForm.get('productArea')?.invalid && productForm.get('productArea')?.touched">
            Must be greater than 0 when provided.
          </div>
        </div>

        <div class="form-group">
          <label for="standardStrength">Compression Standard</label>
          <input 
            type="number" 
            id="standardStrength" 
            formControlName="standardStrength" 
            class="form-control"
            [class.is-invalid]="productForm.get('standardStrength')?.invalid && productForm.get('standardStrength')?.touched"
            placeholder="e.g. 15"
          >
          <div class="invalid-feedback" *ngIf="productForm.get('standardStrength')?.invalid && productForm.get('standardStrength')?.touched">
            Must be greater than 0.
          </div>
        </div>

        <div class="form-group">
          <label for="standardHeight">Standard Height</label>
          <input 
            type="number" 
            id="standardHeight" 
            formControlName="standardHeight" 
            class="form-control"
            [class.is-invalid]="productForm.get('standardHeight')?.invalid && productForm.get('standardHeight')?.touched"
            placeholder="e.g. 200 (optional)"
          >
          <div class="invalid-feedback" *ngIf="productForm.get('standardHeight')?.invalid && productForm.get('standardHeight')?.touched">
            Must be greater than 0 when provided.
          </div>
        </div>

        <div class="form-group">
          <label for="standardWeight">Standard Weight (kg)</label>
          <input 
            type="number" 
            id="standardWeight" 
            formControlName="standardWeight" 
            class="form-control"
            [class.is-invalid]="productForm.get('standardWeight')?.invalid && productForm.get('standardWeight')?.touched"
            placeholder="e.g. 12 (optional)"
          >
          <div class="invalid-feedback" *ngIf="productForm.get('standardWeight')?.invalid && productForm.get('standardWeight')?.touched">
            Must be greater than 0 when provided.
          </div>
        </div>

        <div class="form-group toggle-group">
          <label class="toggle-label">
            <span>Active</span>
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
        <button class="btn-secondary btn-sm" (click)="close()" [disabled]="saving">Cancel</button>
        <button class="btn-primary btn-sm" (click)="save()" [disabled]="productForm.invalid || saving">
          {{ saving ? 'Saving...' : 'Save Product' }}
        </button>
      </div>
    </mat-dialog-actions>
  `,
  styles: [`
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
  `]
})
export class ProductDialogComponent implements OnInit {
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
          this.errorMessage = err?.message || 'Failed to save product. Please try again.';
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
          this.errorMessage = err?.message || 'Failed to save product. Please try again.';
        }
      });
    }
  }
}
