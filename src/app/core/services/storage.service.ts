import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { DB_NAME, DB_VERSION, STORE_NAMES } from '../constants/storage.constants';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private db: IDBDatabase | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<IDBDatabase> | null = null;

  constructor() {}

  /**
   * Initializes and opens the IndexedDB connection.
   * Handles database schema creation on version upgrades.
   */
  connect(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event: Event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        console.error('IndexedDB Error:', error);
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(error);
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isConnecting = false;
        resolve(this.db);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create all object stores if they do not exist
        Object.values(STORE_NAMES).forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
    });

    return this.connectionPromise;
  }

  /**
   * Adds a new record to the specified store.
   */
  add<T>(storeName: string, data: T): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.connect().then(db => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);

        request.onsuccess = () => {
          subscriber.next(data);
          subscriber.complete();
        };

        request.onerror = (event: Event) => {
          console.error(`Error adding record to ${storeName}:`, (event.target as IDBRequest).error);
          subscriber.error((event.target as IDBRequest).error);
        };
      }).catch(err => subscriber.error(err));
    });
  }

  /**
   * Gets a record by ID from the specified store.
   */
  getById<T>(storeName: string, id: string): Observable<T | undefined> {
    return new Observable<T | undefined>((subscriber) => {
      this.connect().then(db => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = (event: Event) => {
          subscriber.next((event.target as IDBRequest).result as T | undefined);
          subscriber.complete();
        };

        request.onerror = (event: Event) => {
          console.error(`Error getting record from ${storeName}:`, (event.target as IDBRequest).error);
          subscriber.error((event.target as IDBRequest).error);
        };
      }).catch(err => subscriber.error(err));
    });
  }

  /**
   * Gets all records from the specified store.
   */
  getAll<T>(storeName: string): Observable<T[]> {
    return new Observable<T[]>((subscriber) => {
      this.connect().then(db => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (event: Event) => {
          subscriber.next((event.target as IDBRequest).result as T[]);
          subscriber.complete();
        };

        request.onerror = (event: Event) => {
          console.error(`Error getting all records from ${storeName}:`, (event.target as IDBRequest).error);
          subscriber.error((event.target as IDBRequest).error);
        };
      }).catch(err => subscriber.error(err));
    });
  }

  /**
   * Updates an existing record in the specified store.
   */
  update<T>(storeName: string, data: T): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.connect().then(db => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => {
          subscriber.next(data);
          subscriber.complete();
        };

        request.onerror = (event: Event) => {
          console.error(`Error updating record in ${storeName}:`, (event.target as IDBRequest).error);
          subscriber.error((event.target as IDBRequest).error);
        };
      }).catch(err => subscriber.error(err));
    });
  }

  /**
   * Deletes a record by ID from the specified store.
   */
  delete(storeName: string, id: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      this.connect().then(db => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
          subscriber.next();
          subscriber.complete();
        };

        request.onerror = (event: Event) => {
          console.error(`Error deleting record from ${storeName}:`, (event.target as IDBRequest).error);
          subscriber.error((event.target as IDBRequest).error);
        };
      }).catch(err => subscriber.error(err));
    });
  }

  /**
   * Clears all records from the specified store.
   */
  clear(storeName: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      this.connect().then(db => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          subscriber.next();
          subscriber.complete();
        };

        request.onerror = (event: Event) => {
          console.error(`Error clearing store ${storeName}:`, (event.target as IDBRequest).error);
          subscriber.error((event.target as IDBRequest).error);
        };
      }).catch(err => subscriber.error(err));
    });
  }

  /**
   * Counts the number of records in the specified store.
   */
  count(storeName: string): Observable<number> {
    return new Observable<number>((subscriber) => {
      this.connect().then(db => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = (event: Event) => {
          subscriber.next((event.target as IDBRequest).result as number);
          subscriber.complete();
        };

        request.onerror = (event: Event) => {
          console.error(`Error counting records in ${storeName}:`, (event.target as IDBRequest).error);
          subscriber.error((event.target as IDBRequest).error);
        };
      }).catch(err => subscriber.error(err));
    });
  }
}
