import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MaterialDialogComponent } from './material-dialog.component';
import { MaterialService } from '../../../core/services/material.service';
import { Material } from '../../../core/models/material.model';

@Component({
  selector: 'app-settings-materials',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatSnackBarModule,
    EmptyStateComponent
  ],
  template: `
    <div class="settings-section">
      <div class="section-header">
        <div class="header-text">
          <h2>Master Materials</h2>
          <p>Manage raw materials available for recipes and production.</p>
        </div>
        <div class="header-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Search materials..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
          </div>
          <button  color="primary" class="btn-primary  " (click)="openDialog()">
            <mat-icon>add</mat-icon> Add Material
          </button>
        </div>
      </div>

      <div class="table-container" *ngIf="filteredMaterials.length > 0">
        <table mat-table [dataSource]="filteredMaterials" class="tpms-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef> Name </th>
            <td mat-cell *matCellDef="let element"> <span class="font-medium">{{element.name}}</span> </td>
          </ng-container>

          <ng-container matColumnDef="unit">
            <th mat-header-cell *matHeaderCellDef> Production Unit </th>
            <td mat-cell *matCellDef="let element"> {{element.unit}} </td>
          </ng-container>

          <ng-container matColumnDef="conversionKgPerM3">
            <th mat-header-cell *matHeaderCellDef> Kg / m³ </th>
            <td mat-cell *matCellDef="let element">
              <span *ngIf="element.conversionKgPerM3 != null && element.conversionKgPerM3 > 0">{{element.conversionKgPerM3}}</span>
              <span *ngIf="element.conversionKgPerM3 == null || element.conversionKgPerM3 <= 0" class="unconfigured">Not set</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef> Status </th>
            <td mat-cell *matCellDef="let element">
              <span class="status-badge" [class.status-active]="element.active" [class.status-inactive]="!element.active">
                {{element.active ? 'Active' : 'Inactive'}}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"> Actions </th>
            <td mat-cell *matCellDef="let element" class="actions-col">
              <div class="table-actions">
                <button mat-icon-button class="action-btn" title="Edit" (click)="openDialog(element)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button class="action-btn delete-btn" title="Delete" (click)="deleteMaterial(element)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

      <app-empty-state
        *ngIf="!loading && filteredMaterials.length === 0"
        icon="inventory_2"
        title="No materials found"
        description="Add your first raw material to get started."
        actionLabel="Add Material"
        (action)="openDialog()"
      ></app-empty-state>
    </div>
  `,
  styles: [`
    .settings-section { display: flex; flex-direction: column; gap: var(--space-6); }
    .section-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); flex-wrap: wrap; }
    .header-text h2 { margin: 0; font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--text-primary); }
    .header-text p { margin: 4px 0 0 0; color: var(--text-secondary); font-size: var(--text-sm); }
    .header-actions { display: flex; align-items: center; gap: var(--space-3); }
    
    .search-bar { position: relative; display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0 var(--space-3); height: 36px; width: 250px; }
    .search-bar input { border: none; background: transparent; outline: none; padding: 0 var(--space-2); width: 100%; font-size: var(--text-sm); }
    .search-icon { color: var(--text-muted); font-size: 20px; width: 20px; height: 20px; }
    
    .add-btn { height: 36px; }
    
    .table-container { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); overflow: hidden; }
    .tpms-table { width: 100%; }
    
    .status-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: var(--text-xs); font-weight: var(--weight-semibold); }
    .status-active { background: var(--success-light); color: var(--success-dark); }
    .status-inactive { background: var(--surface-alt); color: var(--text-secondary); }
    
    .actions-col { width: 120px; text-align: right; white-space: nowrap; }
    .action-btn { color: var(--text-secondary); transform: scale(0.9); }
    .action-btn:hover { color: var(--accent); background: var(--accent-light); }
    .delete-btn:hover { color: var(--error); background: var(--error-light); }

    .unconfigured {
      color: var(--text-tertiary);
      font-style: italic;
      font-size: var(--text-xs);
    }
  `]
})
export class MaterialsSettingsComponent implements OnInit {
  private materialService = inject(MaterialService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  materials: Material[] = [];
  filteredMaterials: Material[] = [];
  displayedColumns: string[] = ['name', 'unit', 'conversionKgPerM3', 'status', 'actions'];
  loading = true;
  searchTerm = '';

  ngOnInit(): void {
    this.loadMaterials();
  }

  loadMaterials(): void {
    this.loading = true;
    this.materialService.getAll().subscribe({
      next: (data) => {
        this.materials = data.sort((a, b) => a.name.localeCompare(b.name));
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load materials', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredMaterials = [...this.materials];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredMaterials = this.materials.filter(m => 
      m.name.toLowerCase().includes(term) || 
      m.unit.toLowerCase().includes(term)
    );
  }

  openDialog(material?: Material): void {
    const dialogRef = this.dialog.open(MaterialDialogComponent, {
      width: '400px',
      data: { material }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (material) {
          const updated: Material = { ...material, ...result, updatedAt: new Date().toISOString() };
          this.materialService.update(updated).subscribe({
            next: () => {
              this.snackBar.open('Material updated successfully', 'Close', { duration: 3000 });
              this.loadMaterials();
            },
            error: (err) => {
              console.error('[MaterialsSettings] Update failed:', err);
              this.snackBar.open(
                err?.message || 'Failed to update material. Please try again.',
                'Close', { duration: 5000 }
              );
            }
          });
        } else {
          const newMaterial: Material = {
            id: crypto.randomUUID(),
            ...result,
            createdAt: new Date().toISOString()
          };
          this.materialService.create(newMaterial).subscribe({
            next: () => {
              this.snackBar.open('Material created successfully', 'Close', { duration: 3000 });
              this.loadMaterials();
            },
            error: (err) => {
              console.error('[MaterialsSettings] Create failed:', err);
              this.snackBar.open(
                err?.message || 'Failed to create material. Please try again.',
                'Close', { duration: 5000 }
              );
            }
          });
        }
      }
    });
  }

  deleteMaterial(material: Material): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Material',
        message: 'Are you sure you want to delete ' + material.name + '? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        this.materialService.delete(material.id).subscribe({
          next: () => {
            this.snackBar.open('Material deleted', 'Close', { duration: 3000 });
            this.loadMaterials();
          },
          error: (err) => {
            console.error('[MaterialsSettings] Delete failed:', err);
            this.snackBar.open(
              err?.message || 'Failed to delete material. Please try again.',
              'Close', { duration: 5000 }
            );
          }
        });
      }
    });
  }
}
