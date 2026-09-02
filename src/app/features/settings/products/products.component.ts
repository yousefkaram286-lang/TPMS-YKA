import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ProductService } from '../../../core/services/product.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { Product } from '../../../core/models/product.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ProductDialogComponent } from './product-dialog.component';

@Component({
  selector: 'app-products',
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
          <h2>Products</h2>
          <p>Manage products used throughout TPMS</p>
        </div>
        <div class="section-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Search products..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
            <button *ngIf="searchTerm" mat-icon-button class="clear-btn" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <button class="btn-primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> Add Product
          </button>
        </div>
      </div>

      <div class="section-content">
        <div *ngIf="loading" class="loading-state">
          Loading products...
        </div>

        <ng-container *ngIf="!loading">
          <app-empty-state
            *ngIf="!products.length && !searchTerm"
            icon="inventory_2"
            title="No products yet"
            description="Add your first product to start configuring TPMS."
            (action)="openDialog()"
            actionLabel="Add Product"
          ></app-empty-state>

          <app-empty-state
            *ngIf="!filteredProducts.length && searchTerm"
            icon="search_off"
            title="No products found"
            description="No products matched your search."
            variant="neutral"
          ></app-empty-state>

          <div class="table-container" *ngIf="filteredProducts.length > 0">
            <table mat-table [dataSource]="filteredProducts" class="tpms-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef> Product </th>
                <td mat-cell *matCellDef="let element"> 
                  <div class="font-medium text-primary">{{element.name}}
                    <span *ngIf="element.nameAr" class="name-ar">({{element.nameAr}})</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef> Type </th>
                <td mat-cell *matCellDef="let element">
                  <span *ngIf="element.type">{{element.type}}</span>
                  <span *ngIf="!element.type" class="unconfigured">Not configured</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="dimensions">
                <th mat-header-cell *matHeaderCellDef> Dimensions </th>
                <td mat-cell *matCellDef="let element">
                  <span *ngIf="element.dimensions">{{element.dimensions}}</span>
                  <span *ngIf="!element.dimensions" class="unconfigured">Not configured</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="standardStrength">
                <th mat-header-cell *matHeaderCellDef> Compression Std </th>
                <td mat-cell *matCellDef="let element">
                  <span *ngIf="element.standardStrength != null && element.standardStrength > 0">{{element.standardStrength}}</span>
                  <span *ngIf="element.standardStrength == null || element.standardStrength <= 0" class="unconfigured">Not configured</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="piecesPerPress">
                <th mat-header-cell *matHeaderCellDef> Pieces / Press </th>
                <td mat-cell *matCellDef="let element">
                  <span *ngIf="element.piecesPerPress != null && element.piecesPerPress > 0">{{element.piecesPerPress}}</span>
                  <span *ngIf="element.piecesPerPress == null || element.piecesPerPress <= 0" class="unconfigured">Not configured</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="standardHeight">
                <th mat-header-cell *matHeaderCellDef> Std Height </th>
                <td mat-cell *matCellDef="let element">
                  <span *ngIf="element.standardHeight != null && element.standardHeight > 0">{{element.standardHeight}}</span>
                  <span *ngIf="element.standardHeight == null || element.standardHeight <= 0" class="unconfigured">Not configured</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="standardWeight">
                <th mat-header-cell *matHeaderCellDef> Std Weight (kg) </th>
                <td mat-cell *matCellDef="let element">
                  <span *ngIf="element.standardWeight != null && element.standardWeight > 0">{{element.standardWeight}}</span>
                  <span *ngIf="element.standardWeight == null || element.standardWeight <= 0" class="unconfigured">Not configured</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="productArea">
                <th mat-header-cell *matHeaderCellDef> Product Area </th>
                <td mat-cell *matCellDef="let element">
                  <span *ngIf="element.productArea != null && element.productArea > 0">{{element.productArea}}</span>
                  <span *ngIf="element.productArea == null || element.productArea <= 0" class="unconfigured">Not configured</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef> Active </th>
                <td mat-cell *matCellDef="let element">
                  <app-status-badge 
                    [variant]="element.active ? 'success' : 'neutral'" 
                    [label]="element.active ? 'Active' : 'Inactive'">
                  </app-status-badge>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"> Actions </th>
                <td mat-cell *matCellDef="let element" class="actions-col">
                  <div class="table-actions">
                    <button mat-icon-button (click)="openDialog(element)" class="action-btn" title="Edit">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="deleteProduct(element)" class="action-btn delete-btn" title="Delete">
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

    .name-ar {
      color: var(--text-secondary);
      font-size: var(--text-xs);
      font-weight: var(--weight-normal);
    }

    .unconfigured {
      color: var(--text-tertiary);
      font-style: italic;
      font-size: var(--text-xs);
    }
  `]
})
export class ProductsComponent implements OnInit {
  private productService = inject(ProductService);
  private recipeService = inject(RecipeService);
  private dialog = inject(MatDialog);

  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = true;
  searchTerm = '';
  
  displayedColumns: string[] = ['name', 'type', 'dimensions', 'piecesPerPress', 'standardHeight', 'standardWeight', 'productArea', 'standardStrength', 'status', 'actions'];

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getAll().subscribe({
      next: (data) => {
        this.products = data;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load products', err);
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredProducts = [...this.products];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredProducts = this.products.filter(p => 
      p.name.toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  openDialog(product?: Product): void {
    const dialogRef = this.dialog.open(ProductDialogComponent, {
      width: '480px',
      data: product ? { ...product } : null,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadProducts();
      }
    });
  }

  deleteProduct(product: Product): void {
    // First check relationships
    this.recipeService.getAll().subscribe(recipes => {
      const isReferenced = recipes.some(r => r.productId === product.id);
      
      if (isReferenced) {
        this.dialog.open(ConfirmDialogComponent, {
          data: {
            title: 'Cannot Delete Product',
            message: 'This product is being used by existing recipes and cannot be deleted. Would you like to deactivate it instead?',
            confirmText: 'Deactivate',
            cancelText: 'Cancel',
            variant: 'warning'
          }
        }).afterClosed().subscribe(confirm => {
          if (confirm) {
            const updated = { ...product, active: false };
            this.productService.update(updated).subscribe(() => this.loadProducts());
          }
        });
      } else {
        // Proceed with normal delete confirmation
        this.dialog.open(ConfirmDialogComponent, {
          data: {
            title: 'Delete Product?',
            message: 'Are you sure you want to delete "' + product.name + '"? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'danger'
          }
        }).afterClosed().subscribe(confirm => {
          if (confirm) {
            this.productService.delete(product.id).subscribe(() => this.loadProducts());
          }
        });
      }
    });
  }
}
