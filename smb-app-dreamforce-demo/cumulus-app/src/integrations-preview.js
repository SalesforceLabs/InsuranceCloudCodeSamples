import { createElement } from 'lwc';
import ReviewHandoffSetup from 'c/reviewHandoffSetup';

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; background: #f3f3f3; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .ip-shell { max-width: 52rem; margin: 0 auto; padding: 1.5rem; }
  .ip-crumb { margin: 0 0 1rem; font-size: 1.25rem; font-weight: 700; color: #03234d; }
  .ip-surface { background: #fff; border: 1px solid #c9c9c9; border-radius: 0.75rem; padding: 1rem 1.25rem 1.5rem; }
`;
document.head.appendChild(style);

const root = document.getElementById('root');
const el = createElement('c-review-handoff-setup', { is: ReviewHandoffSetup });
el.selectedRootProduct = 'medical';
root.appendChild(el);
