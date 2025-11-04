#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const p = process.argv[2] || path.join(__dirname, '..', 'examples', 'example-scene.json');
try {
  const s = fs.readFileSync(p, 'utf8');
  const data = JSON.parse(s);
  if (!Array.isArray(data.items)) throw new Error('missing items array');
  data.items.forEach((it, idx) => {
    if (!it.kind) throw new Error('item at index ' + idx + ' missing kind');
    if (!it.position || it.position.length !== 3) throw new Error('item at index ' + idx + ' missing position');
  });
  console.log('OK:', p);
  process.exit(0);
} catch (err) {
  console.error('Invalid scene:', err && err.message ? err.message : err);
  process.exit(2);
}
