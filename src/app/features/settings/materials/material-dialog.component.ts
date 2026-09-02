import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { Material } from '../../../core/models/material.model';

@Component({
  selector: 'app-material-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.material ? 'Edit Material' : 'Add Material' }}</h2>
    
    <mat-dialog-content>
      <form [formGroup]="materialForm" class="tpms-form dialog-form mt-2">
        <div class="form-group">
          <label>Material Name *</label>
          <input type="text" formControlName="name" class="form-control" [class.is-invalid]="isInvalid('name')" placeholder="e.g. Sand">
          <div class="invalid-feedback" *ngIf="isInvalid('name')">Name is required.</div>
        </div>

        <div class="form-group">
          <label>Unit *</label>
          <input type="text" formControlName="unit" class="form-control" [class.is-invalid]="isInvalid('unit')" placeholder="e.g. kg, L, ton">
          <div class="invalid-feedback" *ngIf="isInvalid('unit')">Unit is required.</div>
          <p class="hint-text">Production unit — e.g. kg, L for Water, ton for cbs / aggregate.</p>
        </div>

        <div class="form-group">
          <label>Conversion (kg per m³)</label>
          <input type="number" formControlName="conversionKgPerM3" class="form-control" [class.is-invalid]="isInvalid('conversionKgPerM3')" placeholder="Optional — no default value">
          <div class="invalid-feedback" *ngIf="isInvalid('conversionKgPerM3')">Must be greater than 0 when provided.</div>
        </div>

        <div class="form-group slide-toggle-group mt-3">
          <mat-slide-toggle formControlName="active" color="primary">
            Active Status
          </mat-slide-toggle>
          <p class="hint-text">Inactive materials cannot be used in new recipes.</p>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="materialForm.invalid" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: var(--space-4); min-width: 350px; }
    .form-group { display: flex; flex-direction: column; gap: var(--space-1); }
    .form-group label { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-secondary); }
    .form-control { padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: var(--text-sm); height: 40px; }
    .form-control:focus { outline: none; border-color: var(--accent); }
    .form-control.is-invalid { border-color: var(--error); }
    .invalid-feedback { font-size: var(--text-xs); color: var(--error); }
    .mt-2 { margin-top: var(--space-2); }
    .mt-3 { margin-top: var(--space-3); }
    .hint-text { font-size: var(--text-xs); color: var(--text-tertiary); margin: 4px 0 0 0; }
  `]
})
export class MaterialDialogComponent implements OnInit {
  materialForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<MaterialDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { material?: Material }
  ) {}

  ngOnInit(): void {
    this.materialForm = this.fb.group({
      name: [this.data?.material?.name || '', Validators.required],
      unit: [this.data?.material?.unit || '', Validators.required],
      conversionKgPerM3: [this.data?.material?.conversionKgPerM3 ?? null, [Validators.min(0.01)]],
      active: [this.data?.material?.active ?? true]
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.materialForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  save(): void {
    if (this.materialForm.valid) {
      this.dialogRef.close(this.materialForm.value);
    }
  }
}
