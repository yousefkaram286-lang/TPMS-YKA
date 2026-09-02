import { Component, OnInit, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LineService } from '../../../core/services/line.service';
import { Line } from '../../../core/models/line.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-lines',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
          <h2>Lines</h2>
          <p>Manage production lines</p>
        </div>
        <div class="section-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Search lines..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
            <button *ngIf="searchTerm" mat-icon-button class="clear-btn" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <button class="btn-primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> Add Line
          </button>
        </div>
      </div>

      <div class="section-content">
        <div *ngIf="loading" class="loading-state">
          Loading lines...
        </div>

        <ng-container *ngIf="!loading">
          <app-empty-state
            *ngIf="!lines.length && !searchTerm"
            icon="precision_manufacturing"
            title="No lines yet"
            description="Add your first production line to start configuring TPMS."
            (action)="openDialog()"
            actionLabel="Add Line"
          ></app-empty-state>

          <app-empty-state
            *ngIf="!filteredLines.length && searchTerm"
            icon="search_off"
            title="No lines found"
            description="No lines matched your search."
            variant="neutral"
          ></app-empty-state>

          <div class="table-container" *ngIf="filteredLines.length > 0">
            <table mat-table [dataSource]="filteredLines" class="tpms-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef> Line Name </th>
                <td mat-cell *matCellDef="let element"> 
                  <div class="font-medium text-primary">{{element.name}}</div>
                </td>
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
                    <button mat-icon-button (click)="deleteLine(element)" class="action-btn delete-btn" title="Delete">
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
      color: var(--text-tertiary);
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
export class LinesComponent implements OnInit {
  private lineService = inject(LineService);
  private dialog = inject(MatDialog);

  lines: Line[] = [];
  filteredLines: Line[] = [];
  loading = true;
  searchTerm = '';
  
  displayedColumns: string[] = ['name', 'status', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.loadLines();
  }

  loadLines(): void {
    this.loading = true;
    this.lineService.getAll().subscribe({
      next: (data) => {
        this.lines = data;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load lines', err);
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredLines = [...this.lines];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredLines = this.lines.filter(l => 
      l.name.toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  openDialog(line?: Line): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      width: '480px',
      data: line ? { ...line } : null,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadLines();
      }
    });
  }

  deleteLine(line: Line): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Line?',
        message: `"${line.name}" may be referenced by existing Production, Quality, or Output Release records. Deleting it could break historical data.\n\nWould you like to deactivate it instead? Inactive lines will not appear in new entries but historical records remain intact.`,
        confirmText: 'Deactivate',
        cancelText: 'Cancel',
        variant: 'warning'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        const deactivated: Line = { ...line, active: false, updatedAt: new Date().toISOString() };
        this.lineService.update(deactivated).subscribe({
          next: () => this.loadLines(),
          error: (err) => {
            console.error('[LinesComponent] Deactivate failed:', err);
          }
        });
      }
    });
  }
}

@Component({
  selector: 'app-line-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Line' : 'Add Line' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="lineForm" class="dialog-form">
        <div class="form-group">
          <label>Line Name *</label>
          <input type="text" formControlName="name" class="form-control" placeholder="Enter line name">
          <div class="error" *ngIf="isInvalid('name')">Line name is required</div>
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
      <button mat-button color="primary" (click)="onSave()" [disabled]="lineForm.invalid || saving">
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
export class LineDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<LineDialogComponent>);
  private lineService = inject(LineService);

  public data = inject<Line | null>(MAT_DIALOG_DATA);

  saving = false;
  errorMessage = '';

  lineForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    active: [true]
  });

  constructor() {
    if (this.data) {
      this.lineForm.patchValue(this.data);
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.lineForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSave(): void {
    if (this.lineForm.invalid) {
      this.lineForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const formValue = this.lineForm.value;
    const line: Line = {
      id: this.data?.id || crypto.randomUUID(),
      name: formValue.name!.trim(),
      active: formValue.active ?? true,
      createdAt: this.data?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const save$ = this.data ? this.lineService.update(line) : this.lineService.create(line);

    save$.subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('[LineDialog] Save failed:', err);
        this.saving = false;
        this.errorMessage = err?.message || 'Failed to save line. Please try again.';
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}

