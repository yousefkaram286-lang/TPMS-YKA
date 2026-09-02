/**
 * Minimal in-memory fake of the Supabase POSTgREST query chain used by TPMS
 * services. Pure TypeScript (no Jasmine/Angular deps) so it also compiles in
 * the production build. Supports the exact chains the app actually issues:
 *   select/order, select/eq/single, insert(select/single),
 *   update/eq, delete/eq, and bare select/thenables for awaiting.
 */
export type FakeQueryResult = { data: any; error: { message: string } | null };

export class FakeSupabaseClient {
  constructor(public tables: Record<string, any[]> = {}) {}

  from(table: string): FakeQuery {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
    return new FakeQuery(table, this.tables);
  }

  rowCount(table: string): number {
    return (this.tables[table] ?? []).length;
  }
}

type QueryMode = 'select' | 'insert' | 'delete' | 'update';

class FakeQuery {
  private working: any[];
  private mode: QueryMode = 'select';

  constructor(
    private table: string,
    private tables: Record<string, any[]>
  ) {
    this.working = (this.tables[this.table] ?? []).map(r => ({ ...r }));
  }

  select(_fields?: string): this {
    return this;
  }

  order(_column?: string, _opts?: unknown): Promise<FakeQueryResult> {
    return this.resolve();
  }

  eq(column: string, value: unknown): this {
    if (this.mode === 'delete') {
      this.tables[this.table] = this.tables[this.table].filter(r => r[column] !== value);
      this.working = [];
      return this;
    }
    this.working = this.working.filter(row => row[column] === value);
    return this;
  }

  single(): Promise<FakeQueryResult> {
    return this.resolve(this.working[0]);
  }

  insert(payload: any | any[]): this {
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) {
      this.tables[this.table].push({ ...row });
    }
    this.working = rows.map(r => ({ ...r }));
    return this;
  }

  update(_payload: any): this {
    this.mode = 'update';
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  then(resolve: (value: FakeQueryResult) => void, reject: (err: unknown) => void): Promise<void> {
    return this.resolve().then(resolve, reject);
  }

  private resolve(data: any = this.working): Promise<FakeQueryResult> {
    return Promise.resolve({
      data: Array.isArray(data) ? data.map(r => ({ ...r })) : data,
      error: null
    });
  }
}