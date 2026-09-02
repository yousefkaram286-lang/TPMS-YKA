import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProductMachineConfig } from '../../../core/models/product-machine.model';
import { ProductMachineService } from '../../../core/services/product-machine.service';
import { ProductService } from '../../../core/services/product.service';
import { MachineService } from '../../../core/services/machine.service';
import { Product } from '../../../core/models/product.model';
import { Machine } from '../../../core/models/machine.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-product-machine-dialog',
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
      <h2 mat-dialog-title>{{ isEditMode ? 'Edit Configuration' : 'Add Configuration' }}</h2>
      <button mat-icon-button (click)="close()" class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <div *ngIf="loading" class="loading-text">Loading master data...</div>
      
      <form *ngIf="!loading" [formGroup]="configForm" class="tpms-form">
        <div class="form-group">
          <label for="productId">Product</label>
          <select 
            id="productId" 
            formControlName="productId" 
            class="form-control"
            [class.is-invalid]="configForm.get('productId')?.invalid && configForm.get('productId')?.touched"
          >
            <option value="" disabled>Select Product</option>
            <option *ngFor="let p of products" [value]="p.id">{{ p.name }}</option>
          </select>
          <div class="invalid-feedback" *ngIf="configForm.get('productId')?.invalid && configForm.get('productId')?.touched">
            Product is required.
          </div>
        </div>

        <div class="form-group">
          <label for="machineId">Machine</label>
          <select 
            id="machineId" 
            formControlName="machineId" 
            class="form-control"
            [class.is-invalid]="configForm.get('machineId')?.invalid && configForm.get('machineId')?.touched"
          >
            <option value="" disabled>Select Machine</option>
            <option *ngFor="let m of machines" [value]="m.id">{{ m.name }}</option>
          </select>
          <div class="invalid-feedback" *ngIf="configForm.get('machineId')?.invalid && configForm.get('machineId')?.touched">
            Machine is required.
          </div>
        </div>

        <div class="form-group">
          <label for="piecesPerPress">Pieces / Press</label>
          <input 
            type="number" 
            id="piecesPerPress" 
            formControlName="piecesPerPress" 
            class="form-control"
            [class.is-invalid]="configForm.get('piecesPerPress')?.invalid && configForm.get('piecesPerPress')?.touched"
          >
          <div class="invalid-feedback" *ngIf="configForm.get('piecesPerPress')?.invalid && configForm.get('piecesPerPress')?.touched">
            Must be a whole number greater than 0.
          </div>
        </div>
        
        <div class="invalid-feedback" style="display: block" *ngIf="duplicateError">
          This Product and Machine combination already exists.
        </div>
        
        <div class="invalid-feedback" style="display: block" *ngIf="errorMessage">
          {{ errorMessage }}
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button class="btn-secondary btn-sm" (click)="close()" [disabled]="saving">Cancel</button>
      <button class="btn-primary btn-sm" (click)="save()" [disabled]="configForm.invalid || saving || loading">
        {{ saving ? 'Saving...' : 'Save Configuration' }}
      </button>
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
    
    .loading-text {
      color: var(--text-secondary);
      font-style: italic;
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
  `]
})
export class ProductMachineDialogComponent implements OnInit {
  configForm: FormGroup;
  isEditMode = false;
  saving = false;
  loading = true;
  duplicateError = false;
  errorMessage = '';
  
  products: Product[] = [];
  machines: Machine[] = [];
  existingConfigs: ProductMachineConfig[] = [];
  currentConfigId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProductMachineDialogComponent>,
    private configService: ProductMachineService,
    private productService: ProductService,
    private machineService: MachineService,
    @Inject(MAT_DIALOG_DATA) public data: { config?: ProductMachineConfig, configs: ProductMachineConfig[] }
  ) {
    this.isEditMode = !!data.config;
    this.existingConfigs = data.configs;
    this.currentConfigId = data.config?.id || null;
    
    this.configForm = this.fb.group({
      productId: [{value: '', disabled: this.isEditMode}, Validators.required],
      machineId: [{value: '', disabled: this.isEditMode}, Validators.required],
      piecesPerPress: [null, [Validators.required, Validators.min(1), Validators.pattern('^[0-9]+$')]]
    });
    
    this.configForm.valueChanges.subscribe(() => {
      this.duplicateError = false;
      this.errorMessage = '';
    });
  }

  ngOnInit(): void {
    forkJoin([
      this.productService.getAll(),
      this.machineService.getAll()
    ]).subscribe(([products, machines]) => {
      this.products = products.filter(p => p.active);
      this.machines = machines.filter(m => m.active);
      
      if (this.isEditMode && this.data.config) {
        this.configForm.patchValue({
          productId: this.data.config.productId,
          machineId: this.data.config.machineId,
          piecesPerPress: this.data.config.piecesPerPress
        });
      }
      
      this.loading = false;
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }

    const formValue = this.configForm.getRawValue();
    
    // Check for duplicates
    const isDuplicate = this.existingConfigs.some(c => 
      c.productId === formValue.productId && 
      c.machineId === formValue.machineId && 
      c.id !== this.currentConfigId
    );
    
    if (isDuplicate) {
      this.duplicateError = true;
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    if (this.isEditMode && this.data.config) {
      const updatedConfig: ProductMachineConfig = {
        ...this.data.config,
        piecesPerPress: formValue.piecesPerPress,
        updatedAt: new Date().toISOString()
      };
      
      this.configService.update(updatedConfig).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error('Error saving config:', err);
          this.errorMessage = err?.message || 'Failed to save configuration. Please try again.';
          this.saving = false;
        }
      });
    } else {
      const newConfig: ProductMachineConfig = {
        id: crypto.randomUUID(),
        ...formValue,
        createdAt: new Date().toISOString()
      };
      
      this.configService.create(newConfig).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error('Error saving config:', err);
          this.errorMessage = err?.message || 'Failed to save configuration. Please try again.';
          this.saving = false;
        }
      });
    }
  }
}
