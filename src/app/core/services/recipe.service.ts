import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Recipe } from '../models/recipe.model';

@Injectable({
  providedIn: 'root'
})
export class RecipeService {
  private supabaseService = inject(SupabaseService);
  private tableName = 'recipes';

  // Helper: DB snake_case → frontend camelCase
  private mapToModel(row: any): Recipe {
    return {
      id: row.id,
      productId: row.product_id,
      items: row.items || [], // JSONB auto-parsed by Supabase JS client
      demo: row.demo,
      createdAt: row.created_at,
      updatedAt: row.updated_at !== null ? row.updated_at : undefined
    };
  }

  // Helper: frontend camelCase → DB snake_case
  private mapToDb(recipe: Recipe): any {
    return {
      id: recipe.id,
      product_id: recipe.productId,
      items: recipe.items, // JSONB auto-serialized by Supabase JS client
      demo: recipe.demo,
      created_at: recipe.createdAt,
      updated_at: recipe.updatedAt ?? null
    };
  }

  getAll(): Observable<Recipe[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  getById(id: string): Observable<Recipe | undefined> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          if (error.code === 'PGRST116') return undefined; // Record not found
          throw error;
        }
        return data ? this.mapToModel(data) : undefined;
      }),
      catchError(err => throwError(() => err))
    );
  }

  getByProduct(productId: string): Observable<Recipe[]> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .select('*')
        .eq('product_id', productId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map(row => this.mapToModel(row));
      }),
      catchError(err => throwError(() => err))
    );
  }

  create(recipe: Recipe): Observable<Recipe> {
    const dbRecord = this.mapToDb(recipe);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .insert(dbRecord)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapToModel(data);
      }),
      catchError(err => throwError(() => err))
    );
  }

  update(recipe: Recipe): Observable<Recipe> {
    const dbRecord = this.mapToDb(recipe);
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .update(dbRecord)
        .eq('id', recipe.id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapToModel(data);
      }),
      catchError(err => throwError(() => err))
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabaseService.client
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError(err => throwError(() => err))
    );
  }
}
