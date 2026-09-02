import { Component, OnInit, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators, FormGroup, FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { RecipeService } from '../../../core/services/recipe.service';
import { ProductService } from '../../../core/services/product.service';
import { MaterialService } from '../../../core/services/material.service';
import { Recipe, RecipeItem } from '../../../core/models/recipe.model';
import { Product } from '../../../core/models/product.model';
import { Material } from '../../../core/models/material.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    EmptyStateComponent
  ],
  template: `
    <div class="settings-section">
      <div class="section-header">
        <div class="section-title">
          <h2>Recipes</h2>
          <p>Manage dynamic material recipes for products</p>
        </div>
        <div class="section-actions">
          <div class="search-bar">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Search recipes..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
            <button *ngIf="searchTerm" mat-icon-button class="clear-btn" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <button class="btn-primary" (click)="openDialog()">
            <mat-icon>add</mat-icon> Add Recipe
          </button>
        </div>
      </div>

      <div class="section-content">
        <div *ngIf="loading" class="loading-state">
          Loading recipes...
        </div>

        <ng-container *ngIf="!loading">
          <app-empty-state
            *ngIf="!recipes.length && !searchTerm"
            icon="restaurant"
            title="No recipes yet"
            description="Add your first recipe to start configuring TPMS."
            (action)="openDialog()"
            actionLabel="Add Recipe"
          ></app-empty-state>

          <app-empty-state
            *ngIf="!filteredRecipes.length && searchTerm"
            icon="search_off"
            title="No recipes found"
            description="No recipes matched your search."
            variant="neutral"
          ></app-empty-state>

          <div class="table-container" *ngIf="filteredRecipes.length > 0">
            <table mat-table [dataSource]="filteredRecipes" class="tpms-table">
              <ng-container matColumnDef="product">
                <th mat-header-cell *matHeaderCellDef> Product </th>
                <td mat-cell *matCellDef="let element"> 
                  <div class="font-medium text-primary">
                    {{getProductName(element.productId)}}
                    <span class="demo-badge" *ngIf="element.demo">demo</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="materialsCount">
                <th mat-header-cell *matHeaderCellDef> Ingredients </th>
                <td mat-cell *matCellDef="let element"> {{element.items?.length || 0}} materials </td>
              </ng-container>

              <ng-container matColumnDef="materialsList">
                <th mat-header-cell *matHeaderCellDef> Materials </th>
                <td mat-cell *matCellDef="let element">
                  <span class="materials-list-text" [title]="getMaterialsList(element)">
                    {{getMaterialsList(element)}}
                  </span>
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
                    <button mat-icon-button (click)="deleteRecipe(element)" class="action-btn delete-btn" title="Delete">
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
    .settings-section { display: flex; flex-direction: column; gap: var(--space-6); height: 100%; }
    .section-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4); background: var(--surface); padding: var(--space-5) var(--space-6); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); }
    .section-title h2 { margin: 0 0 var(--space-1) 0; font-size: var(--text-xl); font-weight: var(--weight-semibold); color: var(--text-primary); }
    .section-title p { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); }
    .section-actions { display: flex; gap: var(--space-4); align-items: center; }
    .search-bar { position: relative; display: flex; align-items: center; background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0 var(--space-3); height: 40px; width: 260px; transition: border-color 0.2s; }
    .search-bar:focus-within { border-color: var(--accent); }
    .search-icon { color: var(--text-tertiary); font-size: 20px; width: 20px; height: 20px; }
    .search-bar input { border: none; background: transparent; outline: none; padding: 0 var(--space-2); width: 100%; color: var(--text-primary); font-size: var(--text-sm); }
    .clear-btn { width: 28px; height: 28px; padding: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); }
    .clear-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .section-content { flex: 1; background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); overflow: hidden; display: flex; flex-direction: column; }
    .table-container { overflow-x: auto; }
    .loading-state { padding: var(--space-8); text-align: center; color: var(--text-secondary); }
    .actions-col { width: 120px; text-align: right; white-space: nowrap; }
    .action-btn { color: var(--text-secondary); transform: scale(0.9); }
    .action-btn:hover { color: var(--accent); background: var(--accent-light); }
    .delete-btn:hover { color: var(--error); background: var(--error-light); }
    .materials-list-text { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; color: var(--text-secondary); }

    .demo-badge {
      margin-left: 8px;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      background: var(--warning-light, #fff3e0);
      color: var(--warning, #ef6c00);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      vertical-align: middle;
      text-transform: uppercase;
    }
  `]
})
export class RecipesComponent implements OnInit {
  private recipeService = inject(RecipeService);
  private productService = inject(ProductService);
  private materialService = inject(MaterialService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  recipes: Recipe[] = [];
  filteredRecipes: Recipe[] = [];
  products: Product[] = [];
  materials: Material[] = [];
  
  productsMap = new Map<string, Product>();
  materialsMap = new Map<string, Material>();
  
  loading = true;
  searchTerm = '';
  
  displayedColumns: string[] = ['product', 'materialsCount', 'materialsList', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    let productsLoaded = false;
    let materialsLoaded = false;
    let recipesLoaded = false;

    const checkDone = () => {
      if (productsLoaded && materialsLoaded && recipesLoaded) {
        this.applyFilter();
        this.loading = false;
      }
    };

    this.productService.getAll().subscribe({
      next: (data) => {
        this.products = data;
        data.forEach(p => this.productsMap.set(p.id, p));
        productsLoaded = true;
        checkDone();
      }
    });

    this.materialService.getAll().subscribe({
      next: (data) => {
        this.materials = data;
        data.forEach(m => this.materialsMap.set(m.id, m));
        materialsLoaded = true;
        checkDone();
      }
    });

    this.recipeService.getAll().subscribe({
      next: (data) => {
        this.recipes = data;
        recipesLoaded = true;
        checkDone();
      }
    });
  }

  getProductName(productId: string): string {
    return this.productsMap.get(productId)?.name || 'Unknown Product';
  }

  getMaterialsList(recipe: Recipe): string {
    if (!recipe.items || recipe.items.length === 0) return 'None';
    return recipe.items.map(item => this.materialsMap.get(item.materialId)?.name || 'Unknown').join(', ');
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredRecipes = [...this.recipes];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredRecipes = this.recipes.filter(r => 
      this.getProductName(r.productId).toLowerCase().includes(term) ||
      this.getMaterialsList(r).toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilter();
  }

  openDialog(recipe?: Recipe): void {
    const dialogRef = this.dialog.open(RecipeDialogComponent, {
      width: '600px',
      data: { 
        recipe: recipe ? { ...recipe } : null,
        products: this.products,
        materials: this.materials,
        existingRecipes: this.recipes
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadData();
      }
    });
  }

  deleteRecipe(recipe: Recipe): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Recipe?',
        message: 'Are you sure you want to delete this recipe? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger'
      }
    }).afterClosed().subscribe(confirm => {
      if (confirm) {
        this.recipeService.delete(recipe.id).subscribe({
          next: () => {
            this.snackBar.open('Recipe deleted', 'Close', { duration: 3000 });
            this.loadData();
          },
          error: (err) => {
            console.error('[RecipesComponent] Delete failed:', err);
            this.snackBar.open(err?.message || 'Failed to delete recipe', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }
}

@Component({
  selector: 'app-recipe-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.recipe ? 'Edit Recipe' : 'Add Recipe' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="recipeForm" class="dialog-form tpms-form mt-2">
        <div class="form-group">
          <label>Product *</label>
          <select formControlName="productId" class="form-control" [class.is-invalid]="isInvalid('productId')">
            <option value="">Select Product</option>
            <option *ngFor="let product of data?.products" [value]="product.id">{{ product.name }}</option>
          </select>
          <div class="invalid-feedback" *ngIf="isInvalid('productId')">Product is required.</div>
          <div class="invalid-feedback" *ngIf="recipeForm.hasError('duplicateProduct')">A recipe already exists for this product.</div>
        </div>

        <hr class="divider">
        
        <div class="materials-header">
          <h3>Materials</h3>
          <button type="button" mat-button color="primary" (click)="addMaterial()">
            <mat-icon>add</mat-icon> Add Material
          </button>
        </div>

        <div formArrayName="items" class="materials-list">
          <div class="material-row" *ngFor="let item of items.controls; let i=index" [formGroupName]="i">
            
            <div class="form-group flex-2">
              <label *ngIf="i === 0">Material *</label>
              <select formControlName="materialId" class="form-control" [class.is-invalid]="item.get('materialId')?.invalid && item.get('materialId')?.touched">
                <option value="">Select Material</option>
                <option *ngFor="let m of activeMaterials" [value]="m.id" [disabled]="isMaterialSelected(m.id, i)">
                  {{ m.name }}
                </option>
              </select>
            </div>

            <div class="form-group flex-1">
              <label *ngIf="i === 0">Quantity *</label>
              <div class="input-with-unit">
                <input type="number" formControlName="quantity" class="form-control" min="0.1" step="0.1" [class.is-invalid]="item.get('quantity')?.invalid && item.get('quantity')?.touched">
                <span class="unit-label">{{ getMaterialUnit(item.get('materialId')?.value) }}</span>
              </div>
            </div>

            <div class="form-group row-action" [class.has-label]="i === 0">
              <button type="button" mat-icon-button color="warn" (click)="removeMaterial(i)" title="Remove Material">
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            </div>

          </div>
          
          <div class="empty-materials" *ngIf="items.length === 0">
            No materials added. Click "Add Material" to start.
          </div>
          <div class="invalid-feedback mt-2" *ngIf="recipeForm.hasError('noMaterials')">At least one material is required.</div>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <div class="error-banner" *ngIf="errorMessage">{{ errorMessage }}</div>
      <button mat-button (click)="onCancel()" [disabled]="saving">Cancel</button>
      <button mat-flat-button color="primary" (click)="onSave()" [disabled]="recipeForm.invalid || saving">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: var(--space-4); }
    .mt-2 { margin-top: var(--space-2); }
    .form-group { display: flex; flex-direction: column; gap: var(--space-1); }
    .form-group label { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--text-secondary); }
    .form-control { padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: var(--text-sm); height: 40px; background: var(--surface); color: var(--text-primary); }
    .form-control:focus { outline: none; border-color: var(--accent); }
    .form-control.is-invalid { border-color: var(--error); }
    .invalid-feedback { font-size: var(--text-xs); color: var(--error); margin-top: 2px; }
    
    .divider { border: 0; border-top: 1px solid var(--border-subtle); margin: var(--space-2) 0; }
    
    .materials-header { display: flex; justify-content: space-between; align-items: center; }
    .materials-header h3 { margin: 0; font-size: var(--text-md); font-weight: var(--weight-semibold); color: var(--text-primary); }
    
    .materials-list { display: flex; flex-direction: column; gap: var(--space-3); max-height: 40vh; overflow-y: auto; padding-right: var(--space-2); }
    .material-row { display: flex; gap: var(--space-3); align-items: flex-start; }
    .flex-2 { flex: 2; }
    .flex-1 { flex: 1.5; }
    
    .input-with-unit { display: flex; align-items: center; gap: var(--space-2); }
    .input-with-unit input { flex: 1; }
    .unit-label { font-size: var(--text-sm); color: var(--text-secondary); min-width: 30px; }
    
    .row-action { justify-content: flex-end; }
    .row-action.has-label { padding-top: 24px; }
    
    .empty-materials { padding: var(--space-4); text-align: center; color: var(--text-secondary); font-style: italic; background: var(--surface-alt); border-radius: var(--radius-md); }
    
    .error-banner { flex: 1; font-size: var(--text-xs); color: var(--error); padding: var(--space-1) 0; }
  `]
})
export class RecipeDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<RecipeDialogComponent>);
  private recipeService = inject(RecipeService);
  private snackBar = inject(MatSnackBar);

  public data = inject<{ recipe: Recipe | null, products: Product[], materials: Material[], existingRecipes: Recipe[] }>(MAT_DIALOG_DATA);

  recipeForm!: FormGroup;
  activeMaterials: Material[] = [];
  saving = false;
  errorMessage = '';

  ngOnInit() {
    this.activeMaterials = this.data.materials.filter(m => m.active);

    this.recipeForm = this.fb.group({
      productId: [this.data.recipe?.productId || '', Validators.required],
      items: this.fb.array([])
    }, { validators: [this.materialsRequiredValidator, this.duplicateProductValidator.bind(this)] });

    if (this.data.recipe && this.data.recipe.items) {
      this.data.recipe.items.forEach(item => {
        this.items.push(this.createItemGroup(item.materialId, item.quantity));
      });
    } else {
      this.addMaterial();
    }
  }

  get items(): FormArray {
    return this.recipeForm.get('items') as FormArray;
  }

  createItemGroup(materialId: string = '', quantity: number | null = null): FormGroup {
    return this.fb.group({
      materialId: [materialId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(0.1)]]
    });
  }

  addMaterial(): void {
    this.items.push(this.createItemGroup());
  }

  removeMaterial(index: number): void {
    this.items.removeAt(index);
  }

  getMaterialUnit(materialId: string): string {
    if (!materialId) return '';
    const mat = this.data.materials.find(m => m.id === materialId);
    return mat ? mat.unit : '';
  }

  isMaterialSelected(materialId: string, currentIndex: number): boolean {
    // Prevent selecting the same material twice in the same recipe
    const allItems = this.items.getRawValue();
    return allItems.some((item: any, idx: number) => item.materialId === materialId && idx !== currentIndex);
  }

  isInvalid(controlName: string): boolean {
    const control = this.recipeForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  // Custom Validators
  materialsRequiredValidator(group: FormGroup) {
    const items = group.get('items') as FormArray;
    return items.length > 0 ? null : { noMaterials: true };
  }

  duplicateProductValidator(group: FormGroup) {
    const productId = group.get('productId')?.value;
    if (!productId) return null;
    
    // Check if another recipe already exists for this product (exclude self if editing)
    const currentRecipeId = this.data.recipe?.id;
    const exists = this.data.existingRecipes.some(r => r.productId === productId && r.id !== currentRecipeId);
    
    return exists ? { duplicateProduct: true } : null;
  }

  onSave(): void {
    if (this.recipeForm.invalid) {
      this.recipeForm.markAllAsTouched();
      return;
    }

    const formValue = this.recipeForm.value;
    const recipe: Recipe = {
      id: this.data.recipe?.id || crypto.randomUUID(),
      productId: formValue.productId,
      items: formValue.items,
      createdAt: this.data.recipe?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saving = true;
    this.errorMessage = '';

    const save$ = this.data.recipe ? this.recipeService.update(recipe) : this.recipeService.create(recipe);

    save$.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open('Recipe saved successfully', 'Close', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Failed to save recipe', err);
        this.saving = false;
        this.errorMessage = err?.message || 'Failed to save recipe. Please try again.';
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
