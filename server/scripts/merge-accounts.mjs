// Moves every sign-in method of a duplicate Supabase account onto the account that holds the data, then removes
// the duplicate. App data is encrypted per user id, so only the duplicate's agent-run logs are dropped, never moved.
// usage (from server/): node scripts/merge-accounts.mjs <keep-id-prefix> <duplicate-id-prefix>
import { readFileSync } from "node:fs";
import postgres from "postgres";

const [keepPrefix, dupPrefix] = process.argv.slice(2);
if (!keepPrefix || !dupPrefix) {
  console.log("usage: node scripts/merge-accounts.mjs <keep-id-prefix> <duplicate-id-prefix>");
  process.exit(1);
}

const url = readFileSync(".dev.vars", "utf8").match(/^SUPABASE_DB_URL=(.+)$/m)[1].trim();
const sql = postgres(url, { max: 1 });

const one = async (prefix) => {
  const rows = await sql`select id, email from auth.users where id::text like ${`${prefix}%`}`;
  if (rows.length !== 1) throw new Error(`expected exactly one account starting ${prefix}, found ${rows.length}`);
  return rows[0];
};

try {
  const keep = await one(keepPrefix);
  const dup = await one(dupPrefix);
  await sql.begin(async (tx) => {
    const moved = await tx`update auth.identities set user_id = ${keep.id} where user_id = ${dup.id} returning provider`;
    await tx`delete from public.agent_runs where user_id = ${dup.id}`;
    await tx`delete from auth.users where id = ${dup.id}`;
    console.log(`moved sign-in: ${moved.map((m) => m.provider).join(", ") || "none"}`);
  });
  const [after] = await sql`select array_agg(provider) as providers from auth.identities where user_id = ${keep.id}`;
  console.log(`account ${keep.id.slice(0, 8)} now signs in with: ${after.providers.join(" + ")}`);
} catch (e) {
  console.log(`not merged: ${e.message}`);
} finally {
  await sql.end();
}
