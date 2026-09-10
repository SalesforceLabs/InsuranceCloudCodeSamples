import { LightningElement, api } from 'lwc';
import { lobOptions } from 'data/mockData';

export default class LobPicker extends LightningElement {
  @api value = 'auto';

  get cards() {
    return lobOptions.map((opt) => {
      const selected = opt.value === this.value;
      return {
        ...opt,
        selected,
        isAuto: opt.value === 'auto',
        className: selected ? 'card is-selected' : 'card',
        accentVar: `--accent: ${opt.accent}`,
        radioLabel: selected ? 'Selected' : opt.title,
        radioDotClass: selected ? 'dot is-on' : 'dot'
      };
    });
  }

  handleSelect(event) {
    const value = event.currentTarget.dataset.value;
    if (value && value !== this.value) {
      this.dispatchEvent(
        new CustomEvent('change', { detail: { value } })
      );
    }
  }
}
