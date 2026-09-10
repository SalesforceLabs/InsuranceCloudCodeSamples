#!/usr/bin/env node
/**
 * build-avatars.mjs - Inline the cast headshots into
 * src/assets/avatars/avatars.js as base64 data URIs.
 *
 * Same reasoning as the header-strip avatar in c-account-record-page: the
 * single-file standalone preview only inlines the handful of relative
 * images listed in scripts/package-preview.mjs, so anything shipped as a
 * /public path silently 404s once the HTML is opened over file://. Data
 * URIs sidestep that entirely.
 *
 * To swap a photo, replace public/<slug>-avatar.jpg with a 96x96 square
 * crop and re-run this script. To crop one from a portrait original:
 *
 *   sips -c 380 380 --cropOffset <y> <x> original.png --out crop.png
 *   sips -Z 96 -s format jpeg -s formatOptions 78 crop.png --out out.jpg
 *
 * Run with: node scripts/build-avatars.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');

// Keyed by the sender name the demo data uses, so a lookup is just the
// name off the message - no separate id to keep in sync.
const CAST = [
  ['Elena Rostova', 'elena-avatar.jpg'],
  ['Priya Shah', 'priya-avatar.jpg'],
  ['James Field', 'james-avatar.jpg']
];

const BOT = 'agentforce-mascot.png';

function dataUri(file) {
  const buf = readFileSync(resolve(appRoot, 'public', file));
  const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { uri: `data:${mime};base64,${buf.toString('base64')}`, bytes: buf.length };
}

const entries = CAST.map(([name, file]) => {
  const { uri, bytes } = dataUri(file);
  console.log(`  ${name.padEnd(16)} ${file.padEnd(20)} ${(bytes / 1024).toFixed(1)} KB`);
  return `  '${name}': '${uri}'`;
});

const bot = dataUri(BOT);
console.log(`  ${'(bot)'.padEnd(16)} ${BOT.padEnd(20)} ${(bot.bytes / 1024).toFixed(1)} KB`);

const out = `// AUTO-GENERATED. Do not edit the data URIs by hand.
// Regenerate: node scripts/build-avatars.mjs (see that script for how the
// 96x96 source crops in cumulus-app/public/ are produced).

/** Cast headshots, keyed by the sender name the demo data uses. */
export const AVATARS = {
${entries.join(',\n')}
};

/**
 * Agentforce mascot, for app/bot senders. It is a transparent 24px PNG, so
 * callers sit it on a brand-coloured tile the way Slack renders an app logo
 * rather than stretching it to fill a photo slot.
 */
export const BOT_AVATAR = '${bot.uri}';

/** Headshot for a sender, or undefined when the cast has no photo. */
export function avatarFor(name) {
  return AVATARS[name];
}
`;

const target = resolve(appRoot, 'src/assets/avatars/avatars.js');
writeFileSync(target, out, 'utf8');
console.log(`\nwrote ${target} (${(out.length / 1024).toFixed(1)} KB)`);
