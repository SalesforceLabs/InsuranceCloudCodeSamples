import { createElement } from 'lwc';
import App from 'c/app';
import SetupHome from 'c/setupHome';
import { startDemoIfRequested } from './demo/atlasDemo.js';

const root = document.getElementById('root');

// `?view=setup` is the gear menu's Setup destination, opened in its own
// browser tab. A param on this entry rather than a second HTML file: the
// build declares no extra rollup inputs, so it emits one index.html, and
// the published preview is that single file renamed. A param travels with
// it wherever it lands; a sibling setup.html would not.
const isSetupView =
  new URLSearchParams(window.location.search).get('view') === 'setup';

if (isSetupView) {
  document.title = 'Setup';
  const setup = createElement('c-setup-home', { is: SetupHome });
  // c-setup-home reserves 50px for the .sf-primary global header it sits
  // beneath in c-account-record-page. There is no header here, so hand
  // the host the whole viewport back.
  setup.style.height = '100vh';
  // The waffle asks an ancestor to leave Setup. Nothing owns this tab, so
  // leaving means dropping the param and landing back in the app.
  setup.addEventListener('close', () => {
    window.location.search = '';
  });
  root.appendChild(setup);
} else {
  const app = createElement('c-app', { is: App });
  root.appendChild(app);

  // Guided autoplay demo - only engages when `?demo=<name>` is present.
  startDemoIfRequested();
}
