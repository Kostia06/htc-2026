// SQLite (D1) dialect → Postgres. Covers every construct the server uses and fails loudly on the rest,
// so a query that would misbehave on Postgres is caught by the static scan test, not in production.
//
// Self-contained on purpose: scripts/sqlite-to-postgres.mjs imports this file straight into Node (type stripping),
// so it must use only erasable TypeScript syntax and import nothing.

export class UnsupportedSql extends Error {
  constructor(what: string, sql: string) {
    super(`${what} has no Postgres translation; rewrite the query or extend src/db/translate.ts. SQL: ${sql.trim().slice(0, 200)}`);
    this.name = "UnsupportedSql";
  }
}

// needed to turn INSERT OR REPLACE into an upsert; tables without a primary key are absent on purpose
export const PRIMARY_KEYS: Record<string, string[]> = {
  occupations: ["noc"],
  postings: ["id"],
  courses: ["id"],
  companies: ["id"],
  company_facts: ["id"],
  experiences: ["id"],
  interview_sessions: ["id"],
  user_memories: ["id"],
  agent_runs: ["id"],
  cache: ["key"],
  user_profiles: ["user_id"],
  host_fetches: ["host"],
  cooldowns: ["scope", "key"],
  user_documents: ["id"],
  voice_sessions: ["id"],
  voice_turns: ["session_id", "idx"],
  roadmap_units: ["user_id", "idx"],
  roadmap_steps: ["id"],
  feed_items: ["user_id", "position"],
  feed_state: ["user_id"],
  pairing_offers: ["user_id"],
  memory_vectors: ["id"],
};

// SQLite functions and clauses Postgres lacks; the message tells the author what to do instead
const UNSUPPORTED_FUNCTIONS = /\b(last_insert_rowid|julianday|group_concat|json_extract|json_array|json_object|json_each|json_group_array|total|printf|glob|changes)\s*\(/i;
const UNSUPPORTED_CLAUSES = /\b(PRAGMA|COLLATE\s+NOCASE|AUTOINCREMENT)\b/i;
// Postgres folds unquoted names to lower case, so `AS thisWeek` comes back as `thisweek`; the alias must be quoted
const MIXED_CASE_ALIAS = /\bAS\s+((?=\w*[a-z])(?=\w*[A-Z])\w+)\b/;

type Masked = { code: string; literals: string[] };

const token = (index: number) => `\u0001${index}\u0002`;
const TOKEN = /\u0001(\d+)\u0002/g;

// string literals, quoted identifiers and comments are replaced by tokens so every rewrite below only ever sees code
function mask(sql: string): Masked {
  const literals: string[] = [];
  let code = "";
  let i = 0;
  const take = (end: number) => {
    literals.push(sql.slice(i, end));
    code += token(literals.length - 1);
    i = end;
  };
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      take(end === -1 ? sql.length : end);
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) throw new UnsupportedSql("an unterminated comment", sql);
      take(end + 2);
    } else if (ch === "'" || ch === '"') {
      let end = i + 1;
      for (;;) {
        end = sql.indexOf(ch, end);
        if (end === -1) throw new UnsupportedSql("an unterminated quote", sql);
        if (sql[end + 1] === ch) end += 2; // doubled quote inside the literal
        else break;
      }
      take(end + 1);
    } else {
      code += ch;
      i++;
    }
  }
  return { code, literals };
}

const unmask = ({ code, literals }: Masked) => code.replace(TOKEN, (_, index) => literals[Number(index)]);

const literalValue = (masked: Masked, arg: string, sql: string) => {
  const match = /^\u0001(\d+)\u0002$/.exec(arg.trim());
  const literal = match ? masked.literals[Number(match[1])] : undefined;
  if (!literal || literal[0] !== "'") throw new UnsupportedSql("a date function with a non-literal argument", sql);
  return literal.slice(1, -1).replace(/''/g, "'");
};

const addLiteral = (masked: Masked, text: string) => {
  masked.literals.push(`'${text.replace(/'/g, "''")}'`);
  return token(masked.literals.length - 1);
};

// SQLite's strftime directives → to_char patterns; letters in the format must be quoted for to_char
const STRFTIME: Record<string, string> = { Y: "YYYY", m: "MM", d: "DD", H: "HH24", M: "MI", S: "SS", f: "SS.MS", j: "DDD", "%": "%" };

function toCharFormat(format: string, sql: string) {
  let out = "";
  let literal = "";
  const flush = () => {
    if (!literal) return;
    if (literal.includes('"')) throw new UnsupportedSql("a double quote inside a strftime format", sql);
    out += /[A-Za-z]/.test(literal) ? `"${literal}"` : literal;
    literal = "";
  };
  for (let i = 0; i < format.length; i++) {
    if (format[i] !== "%") {
      literal += format[i];
      continue;
    }
    const directive = STRFTIME[format[++i]];
    if (!directive) throw new UnsupportedSql(`the strftime directive %${format[i]}`, sql);
    flush();
    out += directive;
  }
  flush();
  return out;
}

// 'now' plus modifiers like '-7 days' → now() at time zone 'utc' - interval '7 days'
function nowExpression(modifiers: string[], sql: string) {
  let expr = "now() at time zone 'utc'";
  for (const modifier of modifiers) {
    const match = /^([+-])\s*(\d+(?:\.\d+)?)\s+(second|minute|hour|day|month|year)s?$/i.exec(modifier.trim());
    if (!match) throw new UnsupportedSql(`the date modifier '${modifier}'`, sql);
    expr += ` ${match[1]} interval '${match[2]} ${match[3].toLowerCase()}s'`;
  }
  return expr;
}

// our timestamp columns are ISO text, so the Postgres side formats text too instead of switching to timestamptz
function translateDateFunctions(masked: Masked, sql: string) {
  masked.code = masked.code.replace(/\b(datetime|strftime)\s*\(([^()]*)\)/gi, (_, fn: string, rawArgs: string) => {
    const args = rawArgs.split(",").map((arg) => literalValue(masked, arg, sql));
    const [format, rest] = fn.toLowerCase() === "strftime" ? [toCharFormat(args[0] ?? "", sql), args.slice(1)] : ["YYYY-MM-DD HH24:MI:SS", args];
    if (rest[0] !== "now") throw new UnsupportedSql(`${fn}() on anything but 'now'`, sql);
    return `to_char(${nowExpression(rest.slice(1), sql)}, ${addLiteral(masked, format)})`;
  });
}

const INSERT_OR = /^(\s*)INSERT\s+OR\s+(IGNORE|REPLACE)\s+INTO\s+([\w.]+|\u0001\d+\u0002)\s*(\(([^)]*)\))?/i;

function translateInsertOr(masked: Masked, sql: string) {
  const match = INSERT_OR.exec(masked.code);
  if (!match) return;
  const [whole, lead, mode, table, columnList, columns] = match;
  const unquoted = unmask({ code: table, literals: masked.literals }).replace(/"/g, "");
  let conflict: string;
  if (mode.toUpperCase() === "IGNORE") {
    conflict = "ON CONFLICT DO NOTHING";
  } else {
    const keys = PRIMARY_KEYS[unquoted.split(".").pop() ?? ""];
    if (!keys) throw new UnsupportedSql(`INSERT OR REPLACE into ${unquoted}, which is not in PRIMARY_KEYS`, sql);
    if (!columns) throw new UnsupportedSql("INSERT OR REPLACE without a column list", sql);
    const updates = columns
      .split(",")
      .map((c) => c.trim())
      .filter((c) => !keys.includes(c))
      .map((c) => `${c} = excluded.${c}`);
    conflict = `ON CONFLICT (${keys.join(", ")}) ${updates.length ? `DO UPDATE SET ${updates.join(", ")}` : "DO NOTHING"}`;
  }
  const body = masked.code.slice(whole.length);
  const returning = /\bRETURNING\b/i.exec(body);
  const [stmt, tail] = returning ? [body.slice(0, returning.index), body.slice(returning.index)] : [body, ""];
  masked.code = `${lead}INSERT INTO ${table}${columnList ? ` ${columnList}` : ""}${stmt.replace(/\s+$/, "")} ${conflict}${tail ? ` ${tail}` : ""}`;
}

// `?` takes the number after the highest one used so far, exactly as SQLite numbers them
function translatePlaceholders(masked: Masked) {
  let highest = 0;
  masked.code = masked.code.replace(/\?(\d+)?/g, (_, explicit?: string) => {
    const n = explicit ? Number(explicit) : highest + 1;
    highest = Math.max(highest, n);
    return `$${n}`;
  });
}

function translateKeywords(masked: Masked, ddl: boolean) {
  let code = masked.code
    .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
    .replace(/\binstr\s*\(/gi, "strpos(")
    // SQLite's LIKE ignores ASCII case; ILIKE is the faithful translation
    .replace(/\bLIKE\b/gi, "ILIKE")
    .replace(/\bWITHOUT\s+ROWID\b/gi, "");
  if (ddl) {
    code = code
      .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, "BIGSERIAL PRIMARY KEY")
      .replace(/\bREAL\b/gi, "DOUBLE PRECISION")
      .replace(/\bBLOB\b/gi, "BYTEA");
  }
  masked.code = code;
}

export type TranslateOptions = { ddl?: boolean };

/** One SQLite statement → one Postgres statement. Throws UnsupportedSql for anything it cannot translate faithfully. */
export function translate(sql: string, options: TranslateOptions = {}): string {
  const masked = mask(sql);
  const unsupported = UNSUPPORTED_FUNCTIONS.exec(masked.code) ?? (options.ddl ? null : UNSUPPORTED_CLAUSES.exec(masked.code));
  if (unsupported) throw new UnsupportedSql(unsupported[1], sql);
  const alias = MIXED_CASE_ALIAS.exec(masked.code);
  if (alias) throw new UnsupportedSql(`the unquoted mixed-case alias ${alias[1]} (write AS "${alias[1]}")`, sql);
  translateDateFunctions(masked, sql);
  translateKeywords(masked, options.ddl ?? false);
  if (options.ddl) {
    // checked after the DDL rewrites, so INTEGER PRIMARY KEY AUTOINCREMENT (now BIGSERIAL) passes and a stray AUTOINCREMENT fails
    const clause = UNSUPPORTED_CLAUSES.exec(masked.code);
    if (clause) throw new UnsupportedSql(clause[1], sql);
  }
  translateInsertOr(masked, sql);
  translatePlaceholders(masked);
  return unmask(masked);
}

/** Splits a script on semicolons outside strings and comments; a comment stays with the statement that follows it. */
export function splitStatements(sql: string): string[] {
  const masked = mask(sql);
  return masked.code
    .split(";")
    .map((piece) => unmask({ code: piece, literals: masked.literals }))
    .filter((piece) => piece.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "").trim().length > 0)
    .map((piece) => piece.replace(/^\s*\n/, ""));
}

const CREATE_TABLE = /^(?:\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.]+"?)/i;

export type MigrationOptions = {
  // every new table gets row level security with no policies, so PostgREST (the anon and publishable keys) can never read it
  rls?: boolean;
  revokeFrom?: string[];
};

/** A whole D1 migration file → a Postgres script. */
export function translateMigration(sql: string, options: MigrationOptions = {}): string {
  const rls = options.rls ?? true;
  const revokeFrom = options.revokeFrom ?? ["anon", "authenticated"];
  const out: string[] = [];
  for (const statement of splitStatements(sql)) {
    const translated = translate(statement, { ddl: true });
    out.push(`${translated.trimEnd()};`);
    const created = CREATE_TABLE.exec(translated);
    if (rls && created) {
      out.push(`ALTER TABLE ${created[1]} ENABLE ROW LEVEL SECURITY;`);
      if (revokeFrom.length) out.push(`REVOKE ALL ON TABLE ${created[1]} FROM ${revokeFrom.join(", ")};`);
    }
  }
  return `${out.join("\n")}\n`;
}
