import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const PARTIALS = path.resolve(import.meta.dirname, 'src/partials');
const INCLUDE = /^([ \t]*)<!--\s*@include\s+([\w./-]+)\s*-->/gm;

/** Inline `<!-- @include name.html -->` from src/partials (recursively), keeping indentation. */
function expand(html, depth = 0) {
  if (depth > 5) throw new Error('partials nested too deeply');
  return html.replace(INCLUDE, (_, indent, name) => {
    const file = path.join(PARTIALS, name);
    const body = expand(fs.readFileSync(file, 'utf8'), depth + 1).trimEnd();
    return body
      .split('\n')
      .map((line) => (line ? indent + line : line))
      .join('\n');
  });
}

const CONTENT = path.resolve(import.meta.dirname, 'src/content.json');
const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// where the product app lives; "Get my plan" and "Sign in" link into its sign-up / sign-in screens.
// Same site under /app by default; set APP_URL in .env.local for an app on another domain.
let APP_URL = '/app';

// the web app's dev server (web/, base /app/); this server forwards /app and /api to it
const WEB_DEV = 'http://localhost:5173';

/** Replace {{ key.path }} (escaped) and {{{ key.path }}} (raw) with values from src/content.json. */
function fill(html) {
  const content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  const lookup = (key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], content);
    if (typeof value !== 'string') throw new Error(`content.json: no string at "${key}"`);
    return value.replaceAll('{brand}', content.brand).replaceAll('{appUrl}', APP_URL.replace(/\/+$/, ''));
  };
  return html
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key) => lookup(key))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => lookup(key).replace(/[&<>"']/g, (c) => ESCAPE[c]));
}

function htmlPartials() {
  return {
    name: 'html-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => fill(expand(html)) },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(PARTIALS) || file === CONTENT) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

/** /app without the slash would miss the web app's base; send it to /app/. */
function appSlash() {
  return {
    name: 'app-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/app' && !req.url.startsWith('/app?')) return next();
        res.writeHead(302, { Location: req.url.replace('/app', '/app/') }).end();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // the deployed app lives on its own subdomain; dev keeps the same-site /app path
  APP_URL = loadEnv(mode, process.cwd(), '').APP_URL || (mode === 'production' ? 'https://app.skillit.study' : APP_URL);
  return {
    plugins: [htmlPartials(), appSlash()],
    server: {
      port: 5180,
      strictPort: true,
      proxy: { '/app/': { target: WEB_DEV, ws: true }, '/api': { target: WEB_DEV } },
    },
    preview: { port: 4173, strictPort: true },
  };
});
