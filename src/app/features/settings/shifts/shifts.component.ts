import { Component, OnInit, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ShiftService } from '../../../core/services/shift.service';
import { Shift } from '../../../core/models/shift.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    EmptyStateComponent,
    StatusBadgeComponent
  ],
  template: `
    <div class="settings-section">
      <div class="section-header">
        <div class="section-title">
          <h2>Shifts</h2>
          <p>Manage work shifts</p>
        </div>
        <div class="section-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Search shifts..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
            <button *ngIf="searchTerm" mat-icon-button class="clear-btn" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <button class="btn-primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> Add Shift
          </button>
        </div>
      </div>

      <div class="section-content">
        <div *ngIf="loading" class="loading-state">
          Loading shifts...
        </div>

        <ng-container *ngIf="!loading">
          <app-empty-state
            *ngIf="!shifts.length && !searchTerm"
            icon="schedule"
            title="No shifts yet"
            description="Add your first work shift to start configuring TPMS."
            (action)="openDialog()"
            actionLabel="Add Shift"
          ></app-empty-state>

          <app-empty-state
            *ngIf="!filteredShifts.length && searchTerm"
            icon="search_off"
            title="No shifts found"
            description="No shifts matched your search."
            variant="neutral"
          ></app-empty-state>

          <div class="table-container" *ngIf="filteredShifts.length > 0">
            <table mat-table [dataSource]="filteredShifts" class="tpms-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef> Shift Name </th>
                <td mat-cell *matCellDef="let element"> 
                  <div class="font-medium text-primary">{{element.name}}</div>
                </td>
              </ng-container>

              <ng-container matColumnDef="time">
                <th mat-header-cell *matHeaderCellDef> Time </th>
                <td mat-cell *matCellDef="let element"> {{element.startTime}} - {{element.endTime}} </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef> Status </th>
                <td mat-cell *matCellDef="let element">
                  <app-status-badge 
                    [variant]="element.active ? 'success' : 'neutral'" 
                    [label]="element.active ? 'Active' : 'Inactive'">
                  </app-status-badge>
                </td>
              </ng-container>

              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef> Created </th>
                <td mat-cell *matCellDef="let element"> {{element.createdAt | date:'shortDate'}} </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"> Actions </th>
                <td mat-cell *matCellDef="let element" class="actions-col">
                  <div class="table-actions">
                    <button mat-icon-button (click)="openDialog(element)" class="action-btn" title="Edit">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="deleteShift(element)" class="action-btn delete-btn" title="Delete">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .settings-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      height: 100%;
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-4);
      background: var(--surface);
      padding: var(--space-5) var(--space-6);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }
    
    .section-title h2 {
      margin: 0 0 var(--space-1) 0;
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      color: var(--text-primary);
    }
    
    .section-title p {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
    
    .section-actions {
      display: flex;
      gap: var(--space-4);
      align-items: center;
    }
    
    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
      background: var(--surface-alt);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0 var(--space-3);
      height: 40px;
      width: 260px;
      transition: border-color 0.2s;
    }
    
    .search-bar:focus-within {
      border-color: var(--accent);
    }
    
    .search-icon {
      color: var(--text-muted);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    
    .search-bar input {
      border: none;
      background: transparent;
      outline: none;
      padding: 0 var(--space-2);
      width: 100%;
      color: var(--text-primary);
      font-size: var(--text-sm);
    }
    
    .clear-btn {
      width: 28px;
      height: 28px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
    }
    
    .clear-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    
    .section-content {
      flex: 1;
      background: var(--surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .table-container {
      overflow-x: auto;
    }
    
    .loading-state {
      padding: var(--space-8);
      text-align: center;
      color: var(--text-secondary);
    }
    
    .actions-col { width: 120px; text-align: right; white-space: nowrap; }
    
    .action-btn {
      color: var(--text-secondary);
      transform: scale(0.9);
    }
    
    .action-btn:hover {
      color: var(--accent);
      background: var(--accent-light);
    }
    
    .delete-btn:hover {
      color: var(--error);
      background: var(--error-light);
    }
  `]
})
export class ShiftsComponent implements OnInit {
  private shiftService = inject(ShiftService);
  private dialog = inject(MatDialog);

  shifts: Shift[] = [];
  filteredShifts: Shift[] = [];
  loading = true;
  searchTerm = '';
  
  displayedColumns: string[] = ['name', 'time', 'status', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.loadShifts();
  }

  loadShifts(): void {
    this.loading = true;
    this.shiftService.getAll().subscribe({
      next: (data) => {
        this.shifts = data;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load shifts', err);
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredShifts = [...this.shifts];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredShifts = this.shifts.filter(s => 
      s.name.toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  openDialog(shift?: Shift): void {
    const dialogRef = this.dialog.open(ShiftDialogComponent, {
      width: '480px',
      data: shift ? { ...shift } : null,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadShifts();
      }
    });
  }

  deleteShift(shift: Shift): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Shift?',
        message: `"${shift.name}" may be referenced by existing Production records. Deleting it could break historical data.\n\nWould you like to deactivate it instead? Inactive shifts will not appear in new entries but historical records remain intact.`,
        confirmText: 'Deactivate',
        cancelText: 'Cancel',
        variant: 'warning'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        const deactivated: Shift = { ...shift, active: false, updatedAt: new Date().toISOString() };
        this.shiftService.update(deactivated).subscribe({
          next: () => this.loadShifts(),
          error: (err) => {
            console.error('[ShiftsComponent] Deactivate failed:', err);
          }
        });
      }
    });
  }
}

@Component({
  selector: 'app-shift-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Shift' : 'Add Shift' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="shiftForm" class="dialog-form">
        <div class="form-group">
          <label>Shift Name *</label>
          <input type="text" formControlName="name" class="form-control" placeholder="Enter shift name">
          <div class="error" *ngIf="isInvalid('name')">Shift name is required</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Start Time *</label>
            <input type="time" formControlName="startTime" class="form-control">
            <div class="error" *ngIf="isInvalid('startTime')">Start time is required</div>
          </div>
          <div class="form-group">
            <label>End Time *</label>
            <input type="time" formControlName="endTime" class="form-control">
            <div class="error" *ngIf="isInvalid('endTime')">End time is required</div>
          </div>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" formControlName="active">
            Active
          </label>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <div class="error-banner" *ngIf="errorMessage">{{ errorMessage }}</div>
      <button mat-button (click)="onCancel()" [disabled]="saving">Cancel</button>
      <button mat-button color="primary" (click)="onSave()" [disabled]="shiftForm.invalid || saving">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
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
      font-size: var(--text-sm);
    }
    
    .form-control:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .error {
      font-size: var(--text-xs);
      color: var(--error);
    }
    
    .error-banner {
      flex: 1;
      font-size: var(--text-xs);
      color: var(--error);
      padding: var(--space-1) 0;
    }
  `]
})
export class ShiftDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<ShiftDialogComponent>);
  private shiftService = inject(ShiftService);

  public data = inject<Shift | null>(MAT_DIALOG_DATA);

  saving = false;
  errorMessage = '';

  shiftForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    active: [true]
  });

  constructor() {
    if (this.data) {
      this.shiftForm.patchValue(this.data);
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.shiftForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSave(): void {
    if (this.shiftForm.invalid) {
      this.shiftForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const formValue = this.shiftForm.value;
    const shift: Shift = {
      id: this.data?.id || crypto.randomUUID(),
      name: formValue.name!.trim(),
      startTime: formValue.startTime!,
      endTime: formValue.endTime!,
      active: formValue.active ?? true,
      createdAt: this.data?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const save$ = this.data ? this.shiftService.update(shift) : this.shiftService.create(shift);

    save$.subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('[ShiftDialog] Save failed:', err);
        this.saving = false;
        this.errorMessage = err?.message || 'Failed to save shift. Please try again.';
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}

