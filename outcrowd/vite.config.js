import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

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

/** Replace {{ key.path }} (escaped) and {{{ key.path }}} (raw) with values from src/content.json. */
function fill(html) {
  const content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  const lookup = (key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], content);
    if (typeof value !== 'string') throw new Error(`content.json: no string at "${key}"`);
    return value.replaceAll('{brand}', content.brand);
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

export default defineConfig({
  plugins: [htmlPartials()],
  server: { port: 5180, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
