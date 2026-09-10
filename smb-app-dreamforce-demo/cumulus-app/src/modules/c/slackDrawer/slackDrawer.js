import { LightningElement, api, track } from 'lwc';
import { slackData } from 'data/mockData';
import { BOT_AVATAR, avatarFor } from '../../../assets/avatars/avatars.js';

const MEMBER_GRADIENTS = [
  'background:linear-gradient(135deg, #066afe, #7c3aed)',
  'background:linear-gradient(135deg, #2EB67D, #36C5F0)',
  'background:linear-gradient(135deg, #E01E5A, #ECB22E)',
  'background:linear-gradient(135deg, #7c3aed, #c23934)'
];

function initials(name = '') {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Parse a Slack-style message body into segments so we can render `*bold*`
 * and `_italic_` markup as real bold/italic text instead of literal asterisks
 * and underscores. The output is an array of { text, className } objects
 * suitable for a `for:each` template loop.
 */
function parseSegments(body = '') {
  const out = [];
  // Tokenize on *bold* or _italic_ runs. Slack treats single-char delimiters
  // as inline emphasis; we keep the same convention.
  const regex = /(\*[^*\n]+\*)|(_[^_\n]+_)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > last) {
      out.push({ id: `s-${i++}`, text: body.slice(last, match.index), className: 'seg' });
    }
    const tok = match[0];
    if (tok.startsWith('*')) {
      out.push({ id: `s-${i++}`, text: tok.slice(1, -1), className: 'seg bold' });
    } else {
      out.push({ id: `s-${i++}`, text: tok.slice(1, -1), className: 'seg italic' });
    }
    last = regex.lastIndex;
  }
  if (last < body.length) {
    out.push({ id: `s-${i++}`, text: body.slice(last), className: 'seg' });
  }
  return out;
}

// System-alert bodies render with the first sentence bolded - gives the
// "status update" rows the recognisable Slackbot/Workflow visual rhythm.
function alertSegments(body = '') {
  const trimmed = body.trim();
  const splitIdx = trimmed.indexOf('. ');
  if (splitIdx === -1) {
    return [{ id: 'a-0', text: trimmed, className: 'seg bold' }];
  }
  const head = trimmed.slice(0, splitIdx + 1);
  const tail = trimmed.slice(splitIdx + 1);
  return [
    { id: 'a-0', text: head, className: 'seg bold' },
    { id: 'a-1', text: tail, className: 'seg' }
  ];
}

// Deterministic gradient per author so the same person keeps the same swatch
// across the stream. Falls back to the first gradient if name is empty.
function gradientFor(name = '') {
  if (!name) return MEMBER_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return MEMBER_GRADIENTS[hash % MEMBER_GRADIENTS.length];
}

function decorate(messages) {
  return messages.map((m) => {
    const author = m.sender || m.author || 'Agentforce';
    const body = m.text || m.body || '';
    const isAlert = !!m.isSystemAlert;

    const reactions = (m.reactions || []).map((r, i) => ({
      id: `${m.id}-r${i}`,
      emoji: r.emoji,
      count: r.count,
      className: r.reacted ? 'reaction is-mine' : 'reaction'
    }));

    const photo = avatarFor(author);
    // App rows show the Agentforce mascot on a light tile, the way Slack
    // renders an app logo. Members without a headshot keep their swatch.
    const appTile = (m.avatarType === 'bot' || isAlert) && !photo;

    let avatarStyle = '';
    if (!appTile) {
      avatarStyle = m.avatarColor ? `background:${m.avatarColor}` : gradientFor(author);
    }

    return {
      ...m,
      author,
      body,
      isSystemAlert: isAlert,
      isStandard: !isAlert,
      role: m.role || '',
      hasRole: !!m.role,
      className: isAlert ? 'msg is-alert' : 'msg',
      initials: initials(author),
      avatarSrc: photo || (appTile ? BOT_AVATAR : ''),
      avatarClass: appTile ? 'msg-avatar msg-avatar_app' : 'msg-avatar',
      avatarStyle,
      segments: isAlert ? alertSegments(body) : parseSegments(body),
      reactions,
      hasReactions: reactions.length > 0,
      hasThread: !!m.thread,
      threadReplies: m.thread?.replies,
      threadLastReply: m.thread?.lastReply,
      // Interactive Slack actions (e.g. "Compare Quotes" on the async
      // quote-ready notification). The button bubbles a `slackaction`
      // event up to c-app, which decides what to do with the actionId.
      actionLabel: m.actionButton?.label,
      actionId: m.actionButton?.actionId,
      hasAction: !!(m.actionButton && m.actionButton.actionId)
    };
  });
}

export default class SlackDrawer extends LightningElement {
  @api open = false;
  @track messages = slackData.messages.slice();

  get channelName() {
    // Strip the leading '#' since the template already renders its own hash span.
    return (slackData.channelName || '').replace(/^#/, '');
  }

  get channelHandle() {
    return slackData.channelName || '';
  }

  get memberCount() {
    return slackData.members.length;
  }

  get composerPlaceholder() {
    return `Message ${this.channelHandle}`;
  }

  // Derive the avatar stack from the actual member list - one swatch per
  // member, cycling the gradient palette.
  get memberStack() {
    return slackData.members.map((name, idx) => ({
      id: `ms-${idx}`,
      initials: initials(name),
      bgStyle: MEMBER_GRADIENTS[idx % MEMBER_GRADIENTS.length]
    }));
  }

  get displayMessages() {
    return decorate(this.messages);
  }

  get drawerClass() {
    return this.open ? 'drawer is-open' : 'drawer';
  }
  get overlayClass() {
    return this.open ? 'overlay is-open' : 'overlay';
  }
  get hiddenAttr() {
    return this.open ? 'false' : 'true';
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  handleOverlayClick() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  handleAction(event) {
    const actionId = event.currentTarget.dataset.actionId;
    const messageId = event.currentTarget.dataset.messageId;
    if (!actionId) return;
    this.dispatchEvent(
      new CustomEvent('slackaction', {
        detail: { actionId, messageId },
        bubbles: true,
        composed: true
      })
    );
  }

  @api
  pushMessage(msg) {
    const id = `s-${Date.now()}`;
    this.messages = [
      ...this.messages,
      {
        id,
        author: msg.author || 'Agentforce',
        avatarColor: msg.avatarColor || '#7c3aed',
        timestamp:
          msg.timestamp ||
          new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        body: msg.body
      }
    ];
  }
}
