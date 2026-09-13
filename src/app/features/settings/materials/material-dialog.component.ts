import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { Material } from '../../../core/models/material.model';
import { TranslationService } from '../../../core/services/translation.service';

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
    <div class="dialog-wrapper tpms-dir" [attr.dir]="translation.dir()">
      <h2 mat-dialog-title>{{ data.material ? translation.translate('settings.materials.dialog.title.edit') : translation.translate('settings.materials.dialog.title.add') }}</h2>

      <mat-dialog-content>
        <form [formGroup]="materialForm" class="tpms-form dialog-form mt-2">
          <div class="form-group">
            <label>{{ translation.translate('settings.materials.dialog.name') }}</label>
            <input type="text" formControlName="name" class="form-control" [class.is-invalid]="isInvalid('name')" [placeholder]="translation.translate('settings.materials.dialog.name.placeholder')">
            <div class="invalid-feedback" *ngIf="isInvalid('name')">{{ translation.translate('settings.materials.dialog.name.error') }}</div>
          </div>

          <div class="form-group">
            <label>{{ translation.translate('settings.materials.dialog.unit') }}</label>
            <input type="text" formControlName="unit" class="form-control" [class.is-invalid]="isInvalid('unit')" [placeholder]="translation.translate('settings.materials.dialog.unit.placeholder')">
            <div class="invalid-feedback" *ngIf="isInvalid('unit')">{{ translation.translate('settings.materials.dialog.unit.error') }}</div>
            <p class="hint-text">{{ translation.translate('settings.materials.dialog.unit.hint') }}</p>
          </div>

          <div class="form-group">
            <label>{{ translation.translate('settings.materials.dialog.conversion') }}</label>
            <input type="number" formControlName="conversionKgPerM3" class="form-control" [class.is-invalid]="isInvalid('conversionKgPerM3')" [placeholder]="translation.translate('settings.materials.dialog.conversion.placeholder')">
            <div class="invalid-feedback" *ngIf="isInvalid('conversionKgPerM3')">{{ translation.translate('settings.materials.dialog.conversion.error') }}</div>
          </div>

          <div class="form-group slide-toggle-group mt-3">
            <mat-slide-toggle formControlName="active" color="primary">
              {{ translation.translate('settings.materials.dialog.active') }}
            </mat-slide-toggle>
            <p class="hint-text">{{ translation.translate('settings.materials.dialog.active.hint') }}</p>
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ translation.translate('settings.materials.dialog.cancel') }}</button>
        <button mat-flat-button color="primary" [disabled]="materialForm.invalid" (click)="save()">{{ translation.translate('settings.materials.dialog.save') }}</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper { display: flex; flex-direction: column; }
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

    .tpms-dir[dir="rtl"] mat-dialog-content,
    .tpms-dir[dir="rtl"] h2 {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] .form-group label,
    .tpms-dir[dir="rtl"] .hint-text {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] input,
    .tpms-dir[dir="rtl"] mat-slide-toggle {
      direction: rtl;
    }
  `]
})
export class MaterialDialogComponent implements OnInit {
  readonly translation = inject(TranslationService);
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
