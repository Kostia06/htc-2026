#!/usr/bin/env node
// One command for local dev, one address: http://localhost:5180 is the landing page and /app/ the web app.
// The landing server forwards /app and /api to the web app's own server on 5173, which sends /api to the server on 8787.
// Run from the repo root with `npm run dev`. Ctrl-C stops all three.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const win = process.platform === 'win32';
const apps = [
  // the API, on its own local database; pnpm because that's what the server's lockfile is
  { name: 'server', color: 33, tool: 'pnpm' },
  { name: 'web', color: 36, tool: 'npm' },
  { name: 'landing', color: 35, tool: 'npm' },
];

for (const { name, tool } of apps) {
  const cwd = path.join(root, name);
  if (existsSync(path.join(cwd, 'node_modules'))) continue;
  console.log(`[${name}] installing dependencies...`);
  const r = spawnSync(tool, ['install'], { cwd, stdio: 'inherit', shell: win });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

let stopping = false;
const ready = new Set();

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      win ? child.kill() : process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
  process.exitCode = code;
}

function prefix(stream, out, tag, onLine) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      out.write(`${tag} ${line}\n`);
      onLine(line);
    }
  });
}

const children = apps.map(({ name, color, tool }) => {
  // detached: each app gets its own process group, so stop() also ends vite under npm
  const child = spawn(tool, ['run', 'dev'], {
    cwd: path.join(root, name),
    shell: win,
    detached: !win,
    // CI: the server's local migrations would otherwise wait for a yes/no nobody can type here
    env: { ...process.env, FORCE_COLOR: '1', CI: 'true' },
  });
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  const onLine = (line) => {
    if (!/ready in|ready on/i.test(line) || ready.has(name)) return;
    ready.add(name);
    if (ready.size === apps.length) {
      console.log(`\n  Open \x1b[1mhttp://localhost:5180\x1b[0m  (landing page; the app is at /app/)\n`);
    }
  };
  prefix(child.stdout, process.stdout, tag, onLine);
  prefix(child.stderr, process.stderr, tag, () => {});
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`${tag} exited with code ${code}; stopping the others.`);
    if (code) console.error(`${tag} If the port is in use, another dev server is already running: close it first.`);
    stop(code || 1);
  });
  return child;
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stop(0));
