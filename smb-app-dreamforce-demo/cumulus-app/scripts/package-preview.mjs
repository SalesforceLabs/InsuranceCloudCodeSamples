#!/usr/bin/env node
/**
 * package-preview.mjs - Produce a single-file, fully offline-capable
 * standalone HTML for the v02 SMB app preview.
 *
 * The Vite build already inlines our JS + component CSS (via
 * vite-plugin-singlefile). What it does NOT inline are three remote
 * assets the runtime still requests over the network:
 *
 *   1. SLDS 2 stylesheet from cdnjs
 *   2. Google Fonts (Inter weights 400-800) CSS + woff2 files
 *   3. Relative-path images that sit alongside index.html
 *      (agentforce-mascot.png in this case)
 *
 * This script takes the already-built preview/v02/index.html and emits
 * preview/v02/atlas-standalone.html with everything inlined so the
 * resulting file can be opened directly via file:// or shared as a
 * single attachment without any external network calls.
 *
 * Run with: node scripts/package-preview.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const SRC = resolve(repoRoot, 'preview/v02/index.html');
const OUT = resolve(repoRoot, 'preview/v02/atlas-standalone.html');

const SLDS_CSS_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/design-system/2.21.1/styles/salesforce-lightning-design-system.min.css';
const INTER_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';

// gstatic serves different woff2 URLs based on user-agent; pretend to
// be desktop Chrome so we get the widest-compatibility variants.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const RELATIVE_IMAGES = ['agentforce-mascot.png', 'header-icons.png'];

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

async function fetchBuffer(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Pull every url(...) reference out of the CSS, fetch each one, and
// rewrite them as base64 data: URIs so the @font-face blocks resolve
// offline.
async function inlineFontCss(css) {
  const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
  const uniqueUrls = [...new Set(urls)];
  const cache = new Map();
  let bytes = 0;
  for (const u of uniqueUrls) {
    const buf = await fetchBuffer(u);
    const mime = u.endsWith('.woff2')
      ? 'font/woff2'
      : u.endsWith('.woff')
        ? 'font/woff'
        : 'application/octet-stream';
    cache.set(u, `data:${mime};base64,${buf.toString('base64')}`);
    bytes += buf.length;
  }
  let out = css;
  for (const [from, to] of cache) {
    out = out.split(from).join(to);
  }
  return { css: out, bytes, count: uniqueUrls.length };
}

function escapeForReplace(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function inlineRelativeImages(html) {
  let out = html;
  let bytes = 0;
  let count = 0;
  for (const name of RELATIVE_IMAGES) {
    const filePath = resolve(repoRoot, 'preview/v02', name);
    let buf;
    try {
      buf = await readFile(filePath);
    } catch {
      console.warn(`  skipped ${name} (not found at ${filePath})`);
      continue;
    }
    const mime = name.endsWith('.png')
      ? 'image/png'
      : name.endsWith('.jpg') || name.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'application/octet-stream';
    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    // Match the relative path inside src="..." (no leading slash, no
    // http). The bundle emits these exactly as the bare filename.
    const pattern = new RegExp(`src=(\\\\?"|")${escapeForReplace(name)}\\1`, 'g');
    const before = out;
    out = out.replace(pattern, (_m, q) => `src=${q}${dataUri}${q}`);
    if (out !== before) {
      count += 1;
      bytes += buf.length;
    }
  }
  return { html: out, bytes, count };
}

async function main() {
  console.log('Packaging preview/v02/index.html → atlas-standalone.html\n');

  console.log('  reading source ...');
  const srcHtml = await readFile(SRC, 'utf8');
  const srcBytes = Buffer.byteLength(srcHtml, 'utf8');
  console.log(`    source size: ${(srcBytes / 1024).toFixed(1)} KB`);

  console.log('  fetching SLDS 2 stylesheet ...');
  const sldsCss = await fetchText(SLDS_CSS_URL);
  console.log(`    SLDS CSS: ${(sldsCss.length / 1024).toFixed(1)} KB`);

  console.log('  fetching Inter font CSS + woff2 files ...');
  const interCssRaw = await fetchText(INTER_CSS_URL);
  const { css: interCss, bytes: fontBytes, count: fontCount } =
    await inlineFontCss(interCssRaw);
  console.log(
    `    Inter fonts: ${fontCount} files, ${(fontBytes / 1024).toFixed(1)} KB`
  );

  // Snip the four external <link> tags + their two preconnect siblings.
  console.log('  rewriting <link> tags + inlining images ...');
  let html = srcHtml;
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/design-system[^"]*"\s*\/?>/i,
    `<style data-inlined="slds-2">\n${sldsCss}\n</style>`
  );
  // Drop the preconnect entries - they're useless without a remote
  // fetch and a few browsers warn when preconnect targets are unused.
  html = html.replace(
    /<link\s+rel="preconnect"\s+href="https:\/\/fonts\.googleapis\.com"\s*\/?>/i,
    ''
  );
  html = html.replace(
    /<link\s+rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"[^>]*\/?>/i,
    ''
  );
  html = html.replace(
    /<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"[^>]*\/?>/i,
    `<style data-inlined="google-fonts-inter">\n${interCss}\n</style>`
  );

  const { html: htmlWithImgs, bytes: imgBytes, count: imgCount } =
    await inlineRelativeImages(html);
  html = htmlWithImgs;
  console.log(
    `    relative images: ${imgCount} files, ${(imgBytes / 1024).toFixed(1)} KB`
  );

  // Final sanity: warn if any non-data http(s) URLs remain in src/href.
  const stragglers = [
    ...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)
  ].map((m) => m[1]);
  if (stragglers.length) {
    console.warn(
      `\n  ${stragglers.length} remote URL(s) still present in the output:`
    );
    for (const u of new Set(stragglers)) {
      console.warn(`    - ${u}`);
    }
  }

  await writeFile(OUT, html, 'utf8');
  const outBytes = Buffer.byteLength(html, 'utf8');
  console.log(
    `\n  wrote ${basename(OUT)}: ${(outBytes / 1024).toFixed(1)} KB (` +
      `+${((outBytes - srcBytes) / 1024).toFixed(1)} KB)`
  );
  console.log(`  ${OUT}`);
}

main().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
