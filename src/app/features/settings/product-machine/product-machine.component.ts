import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ProductMachineService } from '../../../core/services/product-machine.service';
import { ProductService } from '../../../core/services/product.service';
import { MachineService } from '../../../core/services/machine.service';
import { ProductMachineConfig } from '../../../core/models/product-machine.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { forkJoin } from 'rxjs';
import { ProductMachineDialogComponent } from './product-machine-dialog.component';

@Component({
  selector: 'app-product-machine',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    EmptyStateComponent
  ],
  template: `
    <div class="settings-section">
      <div class="section-header">
        <div class="section-title">
          <h2>Production Config</h2>
          <p>Define pieces produced per press for each product and machine combination</p>
        </div>
        <div class="section-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Search configs..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
            <button *ngIf="searchTerm" mat-icon-button class="clear-btn" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <button class="btn-primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> Add Config
          </button>
        </div>
      </div>

      <div class="section-content">
        <div *ngIf="loading" class="loading-state">
          Loading configurations...
        </div>

        <ng-container *ngIf="!loading">
          <app-empty-state
            *ngIf="!configs.length && !searchTerm"
            icon="settings_applications"
            title="No configurations yet"
            description="Add your first product-machine configuration."
            (action)="openDialog()"
            actionLabel="Add Config"
          ></app-empty-state>

          <app-empty-state
            *ngIf="!filteredConfigs.length && searchTerm"
            icon="search_off"
            title="No configurations found"
            description="No configurations matched your search."
            variant="neutral"
          ></app-empty-state>

          <div class="table-container" *ngIf="filteredConfigs.length > 0">
            <table mat-table [dataSource]="filteredConfigs" class="tpms-table">
              <ng-container matColumnDef="product">
                <th mat-header-cell *matHeaderCellDef> Product </th>
                <td mat-cell *matCellDef="let element"> 
                  <div class="font-medium text-primary">{{getProductName(element.productId)}}</div>
                </td>
              </ng-container>

              <ng-container matColumnDef="machine">
                <th mat-header-cell *matHeaderCellDef> Machine </th>
                <td mat-cell *matCellDef="let element"> {{getMachineName(element.machineId)}} </td>
              </ng-container>

              <ng-container matColumnDef="piecesPerPress">
                <th mat-header-cell *matHeaderCellDef> Pieces / Press </th>
                <td mat-cell *matCellDef="let element"> {{element.piecesPerPress}} </td>
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
                    <button mat-icon-button (click)="deleteConfig(element)" class="action-btn delete-btn" title="Delete">
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
export class ProductMachineComponent implements OnInit {
  private configService = inject(ProductMachineService);
  private productService = inject(ProductService);
  private machineService = inject(MachineService);
  private dialog = inject(MatDialog);

  configs: ProductMachineConfig[] = [];
  filteredConfigs: ProductMachineConfig[] = [];
  
  productMap = new Map<string, string>();
  machineMap = new Map<string, string>();
  
  loading = true;
  searchTerm = '';
  
  displayedColumns: string[] = ['product', 'machine', 'piecesPerPress', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    
    forkJoin([
      this.productService.getAll(),
      this.machineService.getAll(),
      this.configService.getAll()
    ]).subscribe({
      next: ([products, machines, configs]) => {
        products.forEach(p => this.productMap.set(p.id, p.name));
        machines.forEach(m => this.machineMap.set(m.id, m.name));
        
        this.configs = configs;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load product machine configs', err);
        this.loading = false;
      }
    });
  }

  getProductName(id: string): string {
    return this.productMap.get(id) || 'Unknown Product';
  }

  getMachineName(id: string): string {
    return this.machineMap.get(id) || 'Unknown Machine';
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredConfigs = [...this.configs];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredConfigs = this.configs.filter(c => 
      this.getProductName(c.productId).toLowerCase().includes(term) ||
      this.getMachineName(c.machineId).toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  openDialog(config?: ProductMachineConfig): void {
    const dialogRef = this.dialog.open(ProductMachineDialogComponent, {
      width: '480px',
      data: config ? { config, configs: this.configs } : { configs: this.configs },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadData();
      }
    });
  }

  deleteConfig(config: ProductMachineConfig): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Configuration?',
        message: 'Are you sure you want to delete this configuration? Production entries will no longer be able to use this combination.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        this.configService.delete(config.id).subscribe({
          next: () => this.loadData(),
          error: (err) => {
            console.error('[ProductMachineComponent] Delete failed:', err);
            // In a real app we'd show a toast here, but console is fine for now
          }
        });
      }
    });
  }
}
