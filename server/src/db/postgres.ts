import { translate } from "./translate";
import type { Database, DbMeta, DbResult, Row, Statement } from "./types";

// what a Postgres driver must provide: postgres.js over Hyperdrive in the Worker, PGlite in tests
export type Executor = {
  query(sql: string, params: unknown[]): Promise<{ rows: Row[]; changes: number }>;
  transaction<T>(fn: (tx: Pick<Executor, "query">) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

// D1 accepts booleans and stores them as integers; undefined is rejected by D1, so it can't matter which way it goes
const bindable = (value: unknown) => (value === undefined ? null : typeof value === "boolean" ? Number(value) : value);

const meta = (changes: number): DbMeta => ({ changes, duration: 0, rows_read: 0, rows_written: changes, last_row_id: 0, changed_db: changes > 0, size_after: 0 });

class PgStatement implements Statement {
  constructor(
    private readonly executor: Pick<Executor, "query">,
    readonly sql: string,
    readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): Statement {
    return new PgStatement(this.executor, this.sql, values.map(bindable));
  }

  async first<T>(column?: string): Promise<T | null> {
    const { rows } = await this.executor.query(this.sql, this.params);
    const row = rows[0];
    if (!row) return null;
    return (column === undefined ? row : (row[column] ?? null)) as T;
  }

  async all<T = Row>(): Promise<DbResult<T>> {
    const { rows, changes } = await this.executor.query(this.sql, this.params);
    return { results: rows as T[], success: true, meta: meta(changes) };
  }

  run<T = Row>(): Promise<DbResult<T>> {
    return this.all<T>();
  }
}

export function postgresDatabase(executor: Executor): Database {
  return {
    // translated once here, so an untranslatable query fails before it ever reaches the database
    prepare: (sql) => new PgStatement(executor, translate(sql)),
    batch: (statements) =>
      executor.transaction(async (tx) => {
        const results = [];
        for (const statement of statements) {
          const { sql, params } = statement as PgStatement;
          results.push(await new PgStatement(tx, sql, params).run());
        }
        return results;
      }) as Promise<DbResult<never>[]>,
  };
}

// COUNT(*) is int8 and SUM() is numeric: both come back as strings by default, while our code expects numbers like D1 gives
const NUMBER_TYPES = {
  int8: { to: 20, from: [20], serialize: String, parse: Number },
  numeric: { to: 1700, from: [1700], serialize: String, parse: Number },
};

const WRITE = /^(INSERT|UPDATE|DELETE|MERGE)\b/i;

/**
 * postgres.js over a Hyperdrive connection string. The driver is loaded on first use so the D1 path never touches it.
 * Settings follow Cloudflare's Hyperdrive guidance: a small pool, no type fetching, prepared statements left on.
 */
export function postgresJsExecutor(connectionString: string): Executor {
  type Sql = import("postgres").Sql;
  let client: Promise<Sql> | undefined;
  const sql = () => (client ??= import("postgres").then(({ default: postgres }) => postgres(connectionString, { max: 5, fetch_types: false, types: NUMBER_TYPES })));
  const run = async (q: Pick<Sql, "unsafe">, text: string, params: unknown[]) => {
    const rows = await q.unsafe(text, params as never[]);
    return { rows: [...rows] as Row[], changes: WRITE.test(rows.command ?? "") ? rows.count : 0 };
  };
  return {
    query: async (text, params) => run(await sql(), text, params),
    transaction: async (fn) => (await sql()).begin((tx) => fn({ query: (text, params) => run(tx, text, params) })) as never,
    close: async () => {
      if (client) await (await client).end({ timeout: 5 });
    },
  };
}
