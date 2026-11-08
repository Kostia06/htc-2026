// Static scan: every SQL string handed to prepare() anywhere in the server must translate, so a SQLite-only construct
// added by anyone fails here, not at runtime on Postgres.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "../src/db/translate";

const SERVER = fileURLToPath(new URL("..", import.meta.url));

function* tsFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* tsFiles(path);
    else if (name.endsWith(".ts")) yield path;
  }
}

// the first string argument of each prepare( call; template interpolations become a placeholder-free marker
const PREPARE = /\.prepare\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;

function sqlStrings(source: string) {
  return [...source.matchAll(PREPARE)].map((m) => (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, "?"));
}

const found: { file: string; sql: string }[] = [];
for (const dir of ["src", "test", "test-pg"]) {
  for (const file of tsFiles(join(SERVER, dir))) {
    if (file.endsWith("translate.test.ts")) continue; // its strings are deliberately untranslatable
    for (const sql of sqlStrings(readFileSync(file, "utf8"))) found.push({ file: file.slice(SERVER.length), sql });
  }
}

describe("every prepare() string in the codebase", () => {
  it("was actually found (the scan is not silently empty)", () => {
    expect(found.length).toBeGreaterThan(100);
    expect(found.some((f) => f.file.startsWith("src/memory/cache.ts"))).toBe(true);
  });

  it.each(found)("translates: $file $sql", ({ sql }) => {
    const out = translate(sql);
    expect(out).not.toMatch(/\?/);
    expect(out).not.toMatch(/\bINSERT\s+OR\b/i);
  });
});
