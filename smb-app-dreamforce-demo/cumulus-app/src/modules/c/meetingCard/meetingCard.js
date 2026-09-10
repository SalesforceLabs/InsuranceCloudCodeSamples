import { LightningElement, api } from 'lwc';

const TYPE_ICONS = {
  'In-Person': '◉',
  Video: '▶',
  Phone: '☎'
};

export default class MeetingCard extends LightningElement {
  @api meeting;

  get typeIcon() {
    return TYPE_ICONS[this.meeting?.type] || '◉';
  }

  get statusClass() {
    return this.meeting?.prepStatus === 'Prep Ready' ? 'pill ready' : 'pill progress';
  }

  handleOpen() {
    this.dispatchEvent(
      new CustomEvent('open', {
        detail: { meetingId: this.meeting?.id },
        bubbles: true,
        composed: true
      })
    );
  }
}
