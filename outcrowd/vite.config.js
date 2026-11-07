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

function htmlPartials() {
  return {
    name: 'html-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => expand(html) },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(PARTIALS)) {
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
