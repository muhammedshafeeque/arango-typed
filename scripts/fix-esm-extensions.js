#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');

function shouldAppendJs(spec) {
  if (!spec) return false;
  if (!(spec.startsWith('./') || spec.startsWith('../'))) return false;
  if (spec.endsWith('.js') || spec.endsWith('.mjs') || spec.endsWith('.json') || spec.endsWith('.node')) return false;
  if (spec.includes('?')) return false;
  return true;
}

function fixFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  let out = src;
  // import ... from '...'
  out = out.replace(/(from\s+['"])(\.\.?\/[\w@/.-]+)(['"])/g, (m, p1, spec, p3) => {
    return shouldAppendJs(spec) ? `${p1}${spec}.js${p3}` : m;
  });
  // export ... from '...'
  out = out.replace(/(export\s+\*?\s*from\s+['"])(\.\.?\/[\w@/.-]+)(['"])/g, (m, p1, spec, p3) => {
    return shouldAppendJs(spec) ? `${p1}${spec}.js${p3}` : m;
  });
  // bare import '...'
  out = out.replace(/(import\s+['"])(\.\.?\/[\w@/.-]+)(['"])/g, (m, p1, spec, p3) => {
    return shouldAppendJs(spec) ? `${p1}${spec}.js${p3}` : m;
  });
  // dynamic import('...')
  out = out.replace(/(import\(\s*['"])(\.\.?\/[\w@/.-]+)(['"]\s*\))/g, (m, p1, spec, p3) => {
    return shouldAppendJs(spec) ? `${p1}${spec}.js${p3}` : m;
  });

  if (out !== src) {
    fs.writeFileSync(filePath, out, 'utf8');
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile() && entry.name.endsWith('.js')) fixFile(p);
  }
}

if (fs.existsSync(distDir)) {
  walk(distDir);
}


