// The subset of D1's API our code uses, so the same store code runs on D1 or Postgres.
// Shapes match D1 exactly: `results`, `meta.changes`, first() → row | null, first(column) → value | null.

export type Row = Record<string, unknown>;

export type DbMeta = { changes: number; duration: number; rows_read: number; rows_written: number; last_row_id: number; changed_db: boolean; size_after: number };

export type DbResult<T = Row> = { results: T[]; success: true; meta: DbMeta };

export type Statement = {
  bind(...values: unknown[]): Statement;
  first<T = Row>(): Promise<T | null>;
  first<T = unknown>(column: string): Promise<T | null>;
  all<T = Row>(): Promise<DbResult<T>>;
  run<T = Row>(): Promise<DbResult<T>>;
};

export type Database = {
  prepare(sql: string): Statement;
  // every statement runs in order inside one transaction; one failure rolls all of them back
  batch<T = Row>(statements: Statement[]): Promise<DbResult<T>[]>;
};
