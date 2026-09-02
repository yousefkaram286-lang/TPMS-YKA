import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StorageService } from './storage.service';
import { STORE_NAMES } from '../constants/storage.constants';
import { LineProductMapping } from '../models/line-product.model';

@Injectable({
  providedIn: 'root'
})
export class LineProductService {
  private storageService = inject(StorageService);
  private storeName = STORE_NAMES.LINE_PRODUCTS;

  getAll(): Observable<LineProductMapping[]> {
    return this.storageService.getAll<LineProductMapping>(this.storeName);
  }

  getById(id: string): Observable<LineProductMapping | undefined> {
    return this.storageService.getById<LineProductMapping>(this.storeName, id);
  }

  create(mapping: LineProductMapping): Observable<LineProductMapping> {
    return this.storageService.add<LineProductMapping>(this.storeName, mapping);
  }

  delete(id: string): Observable<void> {
    return this.storageService.delete(this.storeName, id);
  }
}