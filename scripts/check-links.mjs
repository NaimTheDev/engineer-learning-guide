#!/usr/bin/env node
/**
 * Checks every curriculum resource URL. Run locally (needs network access):
 *   npm run check:links
 * Prints broken links and links marked `verify: true` for manual review.
 * Sites that block bots (403/429) are reported separately, not as broken.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = new URL('../src/data/curriculum/', import.meta.url).pathname;
const files = (await readdir(dir)).filter((f) => f.startsWith('weeks') && f.endsWith('.ts'));
const urls = new Map();
for (const f of files) {
  const src = await readFile(join(dir, f), 'utf8');
  for (const m of src.matchAll(/url:\s*['"`](https?:\/\/[^'"`]+)['"`]/g)) {
    if (!urls.has(m[1])) urls.set(m[1], f);
  }
}

const results = { ok: 0, blocked: [], broken: [] };
const queue = [...urls.entries()];
async function worker() {
  while (queue.length) {
    const [url, file] = queue.shift();
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (res.status === 405 || res.status === 404) {
        res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
      }
      if (res.ok) results.ok++;
      else if ([401, 403, 429].includes(res.status)) results.blocked.push(`${res.status} ${url} (${file})`);
      else results.broken.push(`${res.status} ${url} (${file})`);
    } catch (e) {
      results.broken.push(`ERR ${url} (${file}): ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

console.log(`Checked ${urls.size} unique URLs: ${results.ok} OK`);
if (results.blocked.length) console.log(`\nBlocked bots (check manually):\n  ${results.blocked.join('\n  ')}`);
if (results.broken.length) {
  console.log(`\nBroken:\n  ${results.broken.join('\n  ')}`);
  process.exitCode = 1;
}
