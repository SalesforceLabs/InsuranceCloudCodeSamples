import { LightningElement, api } from 'lwc';
import { ILLUSTRATIONS } from '../../../assets/illustrations/slds2/illustrations.js';
import { BOT_AVATAR, avatarFor } from '../../../assets/avatars/avatars.js';

// Slack_Logo.svg from runtime_slack (ui-slack-components) on the org.
const SLACK_LOGO_SRC =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="slack-logo-color"><g id="Union"><path d="M11.4242 3.47922V5.75922H9.1442C8.7362 5.75922 8.3562 5.65922 8.0042 5.45922C7.6602 5.25122 7.3842 4.97522 7.1762 4.63122C6.9762 4.27922 6.8762 3.89522 6.8762 3.47922C6.8762 3.07122 6.9762 2.69522 7.1762 2.35122C7.3842 1.99922 7.6602 1.71922 8.0042 1.51122C8.3562 1.30322 8.7362 1.19922 9.1442 1.19922C9.5602 1.19922 9.9402 1.30322 10.2842 1.51122C10.6362 1.71122 10.9122 1.98722 11.1122 2.33922C11.3202 2.69122 11.4242 3.07122 11.4242 3.47922Z" fill="#36C5F0"/><path d="M11.1242 10.2952C11.3322 9.94322 11.4362 9.55922 11.4362 9.14322C11.4362 8.73522 11.3322 8.35922 11.1242 8.01522C10.9242 7.66322 10.6482 7.38722 10.2962 7.18722C9.9522 6.97922 9.5722 6.87522 9.1562 6.87522H3.4802C3.0722 6.87522 2.6922 6.97922 2.3402 7.18722C1.9962 7.38722 1.7202 7.66322 1.5122 8.01522C1.3042 8.35922 1.2002 8.73522 1.2002 9.14322C1.2002 9.55922 1.3002 9.94322 1.5002 10.2952C1.7082 10.6392 1.9882 10.9152 2.3402 11.1232C2.6922 11.3232 3.0722 11.4232 3.4802 11.4232H9.1562C9.5722 11.4232 9.9522 11.3232 10.2962 11.1232C10.6482 10.9152 10.9242 10.6392 11.1242 10.2952Z" fill="#36C5F0"/></g><path id="Union_2" d="M12.564 14.8445C12.564 14.4285 12.664 14.0485 12.864 13.7045C13.072 13.3525 13.348 13.0765 13.692 12.8765C14.044 12.6685 14.428 12.5645 14.844 12.5645H20.52C20.928 12.5645 21.308 12.6685 21.66 12.8765C22.012 13.0765 22.288 13.3525 22.488 13.7045C22.696 14.0485 22.8 14.4285 22.8 14.8445C22.8 15.2525 22.696 15.6285 22.488 15.9725C22.288 16.3165 22.012 16.5925 21.66 16.8005C21.308 17.0005 20.928 17.1005 20.52 17.1005H14.844C14.428 17.1005 14.044 17.0005 13.692 16.8005C13.348 16.5925 13.072 16.3165 12.864 15.9725C12.664 15.6285 12.564 15.2525 12.564 14.8445ZM12.564 18.2405V20.5205C12.564 20.9285 12.664 21.3085 12.864 21.6605C13.072 22.0125 13.348 22.2885 13.692 22.4885C14.044 22.6965 14.428 22.8005 14.844 22.8005C15.252 22.8005 15.628 22.6965 15.972 22.4885C16.316 22.2885 16.588 22.0125 16.788 21.6605C16.996 21.3085 17.1 20.9285 17.1 20.5205C17.1 20.1045 16.996 19.7245 16.788 19.3805C16.588 19.0285 16.316 18.7525 15.972 18.5525C15.628 18.3445 15.252 18.2405 14.844 18.2405H12.564Z" fill="#F1B900"/><g id="Union_3"><path d="M2.33995 16.8005C2.69195 17.0005 3.07195 17.1005 3.47995 17.1005C3.89595 17.1005 4.27595 17.0005 4.61995 16.8005C4.97195 16.5925 5.24795 16.3165 5.44795 15.9725C5.65595 15.6285 5.75995 15.2525 5.75995 14.8445V12.5645H3.47995C3.07195 12.5645 2.69195 12.6685 2.33995 12.8765C1.98795 13.0765 1.70795 13.3525 1.49995 13.7045C1.29995 14.0485 1.19995 14.4285 1.19995 14.8445C1.19995 15.2525 1.29995 15.6285 1.49995 15.9725C1.70795 16.3165 1.98795 16.5925 2.33995 16.8005Z" fill="#E01E5A"/><path d="M10.284 12.8765C9.93995 12.6685 9.55995 12.5645 9.14395 12.5645C8.73595 12.5645 8.35595 12.6685 8.00395 12.8765C7.65995 13.0765 7.38395 13.3525 7.17595 13.7045C6.97595 14.0485 6.87595 14.4285 6.87595 14.8445V20.5205C6.87595 20.9285 6.97595 21.3045 7.17595 21.6485C7.38395 22.0005 7.65995 22.2805 8.00395 22.4885C8.35595 22.6965 8.73595 22.8005 9.14395 22.8005C9.55995 22.8005 9.93995 22.6965 10.284 22.4885C10.636 22.2885 10.912 22.0125 11.112 21.6605C11.32 21.3085 11.424 20.9285 11.424 20.5205V14.8445C11.424 14.4285 11.32 14.0485 11.112 13.7045C10.912 13.3525 10.636 13.0765 10.284 12.8765Z" fill="#E01E5A"/></g><g id="Union_4"><path d="M13.692 11.1352C14.044 11.3352 14.428 11.4352 14.844 11.4352C15.252 11.4352 15.628 11.3352 15.972 11.1352C16.316 10.9272 16.588 10.6512 16.788 10.3072C16.996 9.95522 17.1 9.57122 17.1 9.15522V3.47922C17.1 3.07122 16.996 2.69122 16.788 2.33922C16.588 1.98722 16.316 1.71122 15.972 1.51122C15.628 1.30322 15.252 1.19922 14.844 1.19922C14.428 1.19922 14.044 1.30322 13.692 1.51122C13.348 1.71122 13.072 1.98722 12.864 2.33922C12.664 2.69122 12.564 3.07122 12.564 3.47922V9.15522C12.564 9.57122 12.664 9.95522 12.864 10.3072C13.072 10.6512 13.348 10.9272 13.692 11.1352Z" fill="#2EB67D"/><path d="M20.52 11.4232H18.24V9.14322C18.24 8.73522 18.34 8.35922 18.54 8.01522C18.748 7.66322 19.024 7.38722 19.368 7.18722C19.72 6.97922 20.104 6.87522 20.52 6.87522C20.928 6.87522 21.304 6.97922 21.648 7.18722C22 7.38722 22.28 7.66322 22.488 8.01522C22.696 8.35922 22.8 8.73522 22.8 9.14322C22.8 9.55922 22.696 9.94322 22.488 10.2952C22.288 10.6392 22.012 10.9152 21.66 11.1232C21.308 11.3232 20.928 11.4232 20.52 11.4232Z" fill="#2EB67D"/></g></g></svg>'
  );

// Same palette c-slack-drawer uses, so a person keeps one swatch whether
// you meet them in the rail preview or the full drawer.
const MEMBER_GRADIENTS = [
  'background:linear-gradient(135deg, #066afe, #7c3aed)',
  'background:linear-gradient(135deg, #2EB67D, #36C5F0)',
  'background:linear-gradient(135deg, #E01E5A, #ECB22E)',
  'background:linear-gradient(135deg, #7c3aed, #c23934)'
];

const DEFAULT_LIMIT = 4;

function initials(name = '') {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function gradientFor(name = '') {
  if (!name) return MEMBER_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return MEMBER_GRADIENTS[hash % MEMBER_GRADIENTS.length];
}

function parseSegments(body = '') {
  const out = [];
  const regex = /(\*[^*\n]+\*)|(_[^_\n]+_)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > last) {
      out.push({ id: `s-${i++}`, text: body.slice(last, match.index), className: 'seg' });
    }
    const tok = match[0];
    out.push({
      id: `s-${i++}`,
      text: tok.slice(1, -1),
      className: tok.startsWith('*') ? 'seg bold' : 'seg italic'
    });
    last = regex.lastIndex;
  }
  if (last < body.length) {
    out.push({ id: `s-${i++}`, text: body.slice(last), className: 'seg' });
  }
  return out;
}

// Workflow/app posts lead with a bolded first sentence, which is what gives
// Slack's automated rows their distinct rhythm against human messages.
function alertSegments(body = '') {
  const trimmed = body.trim();
  const split = trimmed.indexOf('. ');
  if (split === -1) return [{ id: 'a-0', text: trimmed, className: 'seg bold' }];
  return [
    { id: 'a-0', text: trimmed.slice(0, split + 1), className: 'seg bold' },
    { id: 'a-1', text: trimmed.slice(split + 1), className: 'seg' }
  ];
}

/**
 * Meeting-page Slack sidebar.
 *
 * Default (connected=false) is the org's runtime_slack:slackRecordChannel
 * disconnected card, copied from the Meeting Playbook sidebar. Pass
 * connected=true to render the live `#channel` stream (header, members,
 * day divider, composer). Interactive message blocks bubble `slackaction`.
 *
 * The full-screen conversation lives in c-slack-drawer.
 */
export default class SlackChannelPanel extends LightningElement {
  @api channelName = '';
  @api members = [];
  @api messages = [];
  @api limit = DEFAULT_LIMIT;

  _connected = false;
  _pinnedTo = '';

  // Only an explicit true/'true' opens the live stream. The org default
  // is disconnected, so omitting the attribute must stay closed.
  @api
  get connected() {
    return this._connected;
  }
  set connected(value) {
    this._connected = value === true || value === 'true';
  }

  get showDisconnected() {
    return !this._connected;
  }

  get slackLogoSrc() {
    return SLACK_LOGO_SRC;
  }

  get illustrationSrc() {
    return ILLUSTRATIONS['error:appconnection'];
  }

  get channelLabel() {
    return (this.channelName || '').replace(/^#/, '');
  }

  get channelHandle() {
    const label = this.channelLabel;
    return label ? `#${label}` : '';
  }

  get memberCount() {
    return (this.members || []).length;
  }

  get regionLabel() {
    return `Slack channel ${this.channelHandle}`;
  }

  get memberLabel() {
    const n = this.memberCount;
    return `${n} ${n === 1 ? 'member' : 'members'}`;
  }

  get composerPlaceholder() {
    return `Message ${this.channelHandle}`;
  }

  get streamLabel() {
    return `Messages in ${this.channelHandle}`;
  }

  // Newest last, sitting against the composer, the way an open channel reads.
  get displayMessages() {
    const all = this.messages || [];
    const count = Number(this.limit) || DEFAULT_LIMIT;
    return all.slice(Math.max(0, all.length - count)).map((m) => {
      const author = m.sender || m.author || 'Agentforce';
      const body = m.text || m.body || '';
      const isApp = m.avatarType === 'bot' || !!m.isSystemAlert;
      const photo = avatarFor(author);
      // Slack sits an app's logo on a light tile instead of a coloured
      // initials swatch, and the mascot is a transparent glyph that needs
      // that contrast. Everyone else keeps their swatch, which from here
      // only shows through while the headshot decodes.
      const appTile = isApp && !photo;

      let avatarStyle = '';
      if (!appTile) {
        avatarStyle = m.avatarColor ? `background:${m.avatarColor}` : gradientFor(author);
      }

      return {
        id: m.id,
        author,
        isApp,
        timestamp: m.timestamp,
        initials: initials(author),
        avatarSrc: photo || (isApp ? BOT_AVATAR : ''),
        avatarClass: appTile ? 'slk__avatar slk__avatar_app' : 'slk__avatar',
        avatarStyle,
        segments: m.isSystemAlert ? alertSegments(body) : parseSegments(body),
        actionLabel: m.actionButton?.label,
        actionId: m.actionButton?.actionId,
        applicationId: m.actionButton?.applicationId,
        hasAction: !!m.actionButton?.actionId
      };
    });
  }

  // A channel opens on its newest message, against the composer. Only re-pin
  // when the stream itself changes, so a reader who scrolled up stays put.
  renderedCallback() {
    if (!this._connected) return;
    const signature = this.displayMessages.map((m) => m.id).join('|');
    if (signature === this._pinnedTo) return;
    const stream = this.template.querySelector('.slk__stream');
    if (!stream) return;
    stream.scrollTop = stream.scrollHeight;
    this._pinnedTo = signature;
  }

  handleAction(event) {
    const { actionId, messageId, applicationId } = event.currentTarget.dataset;
    if (!actionId) return;
    this.dispatchEvent(
      new CustomEvent('slackaction', {
        detail: { actionId, messageId, applicationId },
        bubbles: true,
        composed: true
      })
    );
  }
}
