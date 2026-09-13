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
import { TranslationService } from '../../../core/services/translation.service';

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
    <div class="settings-section tpms-dir" [attr.dir]="translation.dir()">
      <div class="section-header">
        <div class="header-text">
          <h2>{{ translation.translate('settings.materials.title') }}</h2>
          <p>{{ translation.translate('settings.materials.subtitle') }}</p>
        </div>
        <div class="header-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" [placeholder]="translation.translate('settings.materials.search')" [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
          </div>
          <button  color="primary" class="btn-primary  " (click)="openDialog()">
            <mat-icon>add</mat-icon> {{ translation.translate('settings.materials.add') }}
          </button>
        </div>
      </div>

      <div class="table-container" *ngIf="filteredMaterials.length > 0">
        <table mat-table [dataSource]="filteredMaterials" class="tpms-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.materials.table.name') }} </th>
            <td mat-cell *matCellDef="let element"> <span class="font-medium">{{element.name}}</span> </td>
          </ng-container>

          <ng-container matColumnDef="unit">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.materials.table.unit') }} </th>
            <td mat-cell *matCellDef="let element"> {{element.unit}} </td>
          </ng-container>

          <ng-container matColumnDef="conversionKgPerM3">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.materials.table.conversion') }} </th>
            <td mat-cell *matCellDef="let element">
              <span *ngIf="element.conversionKgPerM3 != null && element.conversionKgPerM3 > 0">{{element.conversionKgPerM3}}</span>
              <span *ngIf="element.conversionKgPerM3 == null || element.conversionKgPerM3 <= 0" class="unconfigured">{{ translation.translate('settings.materials.conversion.notSet') }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef> {{ translation.translate('settings.materials.table.status') }} </th>
            <td mat-cell *matCellDef="let element">
              <span class="status-badge" [class.status-active]="element.active" [class.status-inactive]="!element.active">
                {{element.active ? translation.translate('settings.materials.status.active') : translation.translate('settings.materials.status.inactive')}}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"> {{ translation.translate('settings.materials.table.actions') }} </th>
            <td mat-cell *matCellDef="let element" class="actions-col">
              <div class="table-actions">
                <button mat-icon-button class="action-btn" [title]="translation.translate('common.edit')" (click)="openDialog(element)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button class="action-btn delete-btn" [title]="translation.translate('common.delete')" (click)="deleteMaterial(element)">
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
        [title]="translation.translate('settings.materials.empty.title')"
        [description]="translation.translate('settings.materials.empty.desc')"
      >
        <button class="btn-primary btn-sm" (click)="openDialog()">
          <mat-icon>add</mat-icon> {{ translation.translate('settings.materials.add') }}
        </button>
      </app-empty-state>
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

    .tpms-dir[dir="rtl"] .section-header {
      flex-direction: row-reverse;
    }
    .tpms-dir[dir="rtl"] .header-text {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] .header-actions {
      flex-direction: row-reverse;
    }
    .tpms-dir[dir="rtl"] .search-bar input {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] .actions-col {
      text-align: left;
    }
    .tpms-dir[dir="rtl"] .table-actions {
      justify-content: flex-start;
    }
    .tpms-dir[dir="rtl"] ::ng-deep .tpms-table .mat-mdc-header-cell {
      text-align: right;
    }
    .tpms-dir[dir="rtl"] ::ng-deep .tpms-table .mat-mdc-cell {
      text-align: right;
    }
  `]
})
export class MaterialsSettingsComponent implements OnInit {
  private materialService = inject(MaterialService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  readonly translation = inject(TranslationService);

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
        this.snackBar.open(this.translation.translate('settings.materials.snackbar.loadError'), this.translation.translate('common.close'), { duration: 3000 });
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
              this.snackBar.open(this.translation.translate('settings.materials.snackbar.updated'), this.translation.translate('common.close'), { duration: 3000 });
              this.loadMaterials();
            },
            error: (err) => {
              console.error('[MaterialsSettings] Update failed:', err);
              this.snackBar.open(
                err?.message || this.translation.translate('settings.materials.snackbar.updateError'),
                this.translation.translate('common.close'), { duration: 5000 }
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
              this.snackBar.open(this.translation.translate('settings.materials.snackbar.created'), this.translation.translate('common.close'), { duration: 3000 });
              this.loadMaterials();
            },
            error: (err) => {
              console.error('[MaterialsSettings] Create failed:', err);
              this.snackBar.open(
                err?.message || this.translation.translate('settings.materials.snackbar.createError'),
                this.translation.translate('common.close'), { duration: 5000 }
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
        title: this.translation.translate('settings.materials.delete.title'),
        message: this.translation.translate('settings.materials.delete.message', { name: material.name }),
        confirmText: this.translation.translate('settings.materials.delete.confirm'),
        cancelText: this.translation.translate('common.cancel'),
        variant: 'danger'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        this.materialService.delete(material.id).subscribe({
          next: () => {
            this.snackBar.open(this.translation.translate('settings.materials.snackbar.deleted'), this.translation.translate('common.close'), { duration: 3000 });
            this.loadMaterials();
          },
          error: (err) => {
            console.error('[MaterialsSettings] Delete failed:', err);
            this.snackBar.open(
              err?.message || this.translation.translate('settings.materials.snackbar.deleteError'),
              this.translation.translate('common.close'), { duration: 5000 }
            );
          }
        });
      }
    });
  }
}
