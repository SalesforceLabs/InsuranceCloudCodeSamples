import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import lwc from 'vite-plugin-lwc';
import { viteSingleFile } from 'vite-plugin-singlefile';

const modulesDir = fileURLToPath(new URL('./src/modules', import.meta.url));
const stylesDir = fileURLToPath(new URL('./src/styles', import.meta.url));

// Set by scripts/build-multi-loc.mjs. When present, the build emits to
// dist-multi-loc/ instead of dist/ so the regular `npm run build`
// output stays untouched. The script also swaps multi-loc.html in as
// index.html for the duration of the build.
const MULTI_LOC_BUILD = process.env.VITE_BUILD_TARGET === 'multi-loc';

// vite-plugin-lwc disables Vite's built-in CSS pipeline (`vite:css` and
// `vite:css-post`) so it can own LWC stylesheet handling. That means our
// project-global tokens.css + overrides.css cannot be loaded via the usual
// `<link rel="stylesheet">` or inline `<style>` blocks — they would either
// be picked up by Rollup as JS imports (and fail) or routed through the
// disabled CSS pipeline. Workaround: read them at config time and inject
// them as a head-level <style> tag via `transformIndexHtml`'s `tags` API,
// which appends tags AFTER Vite's HTML import scanner has run.
function injectAtlasGlobalStyles() {
  // Re-read on every HTML request so edits to tokens.css / overrides.css
  // are picked up by HMR without needing a server restart.
  const read = () => ({
    tokensCss: readFileSync(`${stylesDir}/tokens.css`, 'utf8'),
    overridesCss: readFileSync(`${stylesDir}/overrides.css`, 'utf8')
  });
  return {
    name: 'atlas:inject-global-styles',
    configureServer(server) {
      // Trigger a full reload when either global stylesheet changes so
      // the new <style data-atlas-globals> contents take effect.
      server.watcher.add(`${stylesDir}/tokens.css`);
      server.watcher.add(`${stylesDir}/overrides.css`);
      const reload = (file) => {
        if (file.endsWith('tokens.css') || file.endsWith('overrides.css')) {
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
    },
    transformIndexHtml(html) {
      const { tokensCss, overridesCss } = read();
      return {
        html,
        tags: [
          {
            tag: 'style',
            attrs: { 'data-atlas-globals': 'true' },
            children: `\n${tokensCss}\n${overridesCss}\n`,
            injectTo: 'head'
          }
        ]
      };
    }
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    lwc({
      rootDir: modulesDir,
      modules: [{ dir: modulesDir }],
      // Entry files do their own createElement bootstrapping and
      // must stay out of the LWC compiler pipeline. index.html is
      // hard-excluded by the plugin by default.
      exclude: ['**/styles/**', '**/src/index.js', '**/src/multi-loc.js', '**/src/integrations-preview.js']
    }),
    injectAtlasGlobalStyles(),
    // Inline every JS + CSS chunk into a single HTML file when building.
    // Dev still serves modules incrementally so HMR stays fast.
    ...(command === 'build' ? [viteSingleFile()] : [])
  ],
  server: {
    port: 5175
  },
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    reportCompressedSize: false,
    ...(MULTI_LOC_BUILD ? { outDir: 'dist-multi-loc' } : {})
  }
}));
