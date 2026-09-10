#!/usr/bin/env node
/**
 * publish-preview.mjs - Copy the built bundle into the committed
 * GitHub Pages preview at preview/df-demo/.
 *
 * That preview is a build artefact that lives in git, so a change to
 * src/ is only half the job: until this runs, Pages keeps serving the
 * previous bundle and the demo looks unchanged no matter what was
 * pushed. Run it (or `npm run publish:preview`, which builds first)
 * and commit preview/df-demo/index.html alongside the source change.
 *
 * Only index.html moves. vite-plugin-singlefile inlines the JS, the
 * CSS and every image as a data URI, so the bundle makes no
 * relative-path asset requests - the PNGs sitting next to it in
 * preview/df-demo/ are left over from an earlier build and are
 * verified unreferenced below rather than copied.
 *
 * This is not scripts/package-preview.mjs, which targets preview/v02
 * and additionally inlines the remote SLDS stylesheet and Google
 * Fonts so the output opens over file://. Pages serves those two from
 * the network happily, so df-demo does not need that treatment.
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const repoRoot = resolve(appRoot, '..');

const SRC = resolve(appRoot, 'dist/index.html');
const OUT = resolve(repoRoot, 'preview/df-demo/index.html');

// Assets that used to be fetched by relative path. If the build ever
// stops inlining one of these, it has to be copied next to index.html
// or it 404s on Pages - so fail loudly rather than publish a bundle
// with a broken image.
const MUST_BE_INLINED = [
  'agentforce-mascot.png',
  'header-icons.png',
  'elena-avatar.jpg',
  'james-avatar.jpg',
  'priya-avatar.jpg'
];

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function main() {
  let html;
  try {
    html = await readFile(SRC, 'utf8');
  } catch {
    console.error(
      `No build found at ${relative(repoRoot, SRC)}.\n` +
        'Run `npm run build` first, or use `npm run publish:preview`.'
    );
    process.exit(1);
  }

  const referenced = MUST_BE_INLINED.filter((name) =>
    html.includes(name)
  );
  if (referenced.length) {
    console.error(
      'The build still references these by name, so they are no longer\n' +
        'inlined and would 404 on Pages:\n' +
        referenced.map((n) => `  - ${n}`).join('\n') +
        '\nCopy them into preview/df-demo/ before publishing.'
    );
    process.exit(1);
  }

  let prevBytes = 0;
  try {
    prevBytes = (await stat(OUT)).size;
  } catch {
    // First publish; no previous bundle to diff against.
  }

  await writeFile(OUT, html, 'utf8');
  const bytes = Buffer.byteLength(html, 'utf8');

  console.log(`Published ${relative(repoRoot, OUT)}`);
  console.log(`  ${kb(bytes)}${prevBytes ? ` (was ${kb(prevBytes)})` : ''}`);
  console.log('  every asset inlined - index.html is the only file needed');
  console.log('\nCommit it with the source change:');
  console.log('  git add preview/df-demo/index.html');
}

main().catch((err) => {
  console.error('Publishing the preview failed:', err);
  process.exit(1);
});
