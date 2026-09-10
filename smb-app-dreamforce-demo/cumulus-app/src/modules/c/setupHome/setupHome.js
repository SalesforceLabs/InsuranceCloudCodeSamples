import { LightningElement, track } from 'lwc';

// Setup navigation tree. Headings render as their own <h4> between the
// per-group <ul role="tree"> lists so the uppercase section labels never
// become tree items. A string entry is a leaf; an object entry may carry
// `children` (real subtree) or `isBranch` (chevron with nothing wired
// behind it yet, which is how the org renders most Setup branches).
//
// The tree is arbitrarily deep. Because an LWC template cannot recurse
// into itself, `navGroups` flattens each group into a single ordered row
// list carrying a `level`, and the row's indent is driven off that level
// through the --sh-nav-level custom property.
const NAV_GROUPS = [
  {
    id: 'primary',
    heading: '',
    ariaLabel: 'Setup',
    items: [
      'Setup Home',
      'Salesforce Foundations',
      'Salesforce Go',
      'Commerce Setup Assistant',
      'Hyperforce Assistant',
      'Release Updates',
      'Salesforce Mobile App',
      'Lightning Usage',
      'AgentExchange Offers',
      'Manage Subscription',
      'Integration Definitions',
      'Sales Cloud Everywhere'
    ]
  },
  {
    id: 'administration',
    heading: 'Administration',
    ariaLabel: 'Administration',
    defaultBranch: true,
    items: ['Users', 'Data', 'Email']
  },
  {
    id: 'platform-tools',
    heading: 'Platform Tools',
    ariaLabel: 'Platform Tools',
    defaultBranch: true,
    items: [
      'Apps',
      {
        label: 'Feature Settings',
        children: [
          {
            label: 'Brokerage',
            children: [
              'Agency Billing Setup',
              'Brokerage General Settings',
              'Commissions Management',
              {
                label: 'Policy Management',
                children: [
                  'Coverage Benefits',
                  'Policy Lifecycle',
                  'Premium Calculation',
                  'Rate Plan'
                ]
              },
              {
                label: 'Quote Management Settings',
                children: [
                  'Request For Quote Template',
                  'Quote Compare Template'
                ]
              }
            ]
          }
        ]
      },
      'Slack',
      'Workflow Services',
      'Data Cloud',
      'Heroku',
      'MuleSoft',
      'Einstein',
      'Objects and Fields',
      'Events',
      'Process Automation',
      'User Interface',
      'Custom Code',
      'Development',
      'Scale',
      'Environments',
      'User Engagement',
      'Integrations',
      'Notification Builder',
      'Offline',
      'Go Accelerate'
    ]
  },
  {
    id: 'settings',
    heading: 'Settings',
    ariaLabel: 'Settings',
    defaultBranch: true,
    items: [
      'Company Settings',
      'Salesforce Release Manager',
      'Data Classification',
      'Privacy Center',
      'Identity',
      'Security'
    ]
  }
];

const GOAL_CARDS = [
  {
    id: 'inline-solution-installation',
    category: 'IT Service',
    categoryTone: 'it',
    pill: '',
    title: 'Inline Solution Installation',
    description:
      'Install configurable solutions inline as part of your initial cloud setup.',
    status: 'In Progress',
    cta: 'Keep Going'
  },
  {
    id: 'insurance-brokerage-initial-setup',
    category: 'Financial Services',
    categoryTone: 'fins',
    pill: 'Insurance',
    title: 'Insurance Brokerage Initial Setup',
    description:
      'Streamline brokerage by configuring products, policies, commissions, billing, and access.',
    status: 'In Progress',
    cta: 'Keep Going'
  },
  {
    id: 'policy-and-claims-access-initial-setup',
    category: 'Financial Services',
    categoryTone: 'fins',
    pill: 'Insurance',
    title: 'Policy and Claims Access Initial Setup',
    description:
      'Support agents in efficiently assisting policyholders with seamless access to policy and claims information.',
    status: 'In Progress',
    cta: 'Keep Going'
  }
];

const RECENT_ITEMS = [
  { id: 'admin-user', name: 'Admin User', type: 'User', object: '' },
  {
    id: 'account-layout',
    name: 'Account Layout',
    type: 'Page Layout',
    object: 'Account'
  },
  {
    id: 'account-record-page',
    name: 'Account Record Page',
    type: 'Lightning Page',
    object: ''
  },
  {
    id: 'insured-item',
    name: 'Insured Item',
    type: 'Record Type',
    object: 'Product'
  },
  {
    id: 'insured-party',
    name: 'Insured Party',
    type: 'Record Type',
    object: 'Product'
  }
];

function slug(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// Turns the authoring shorthand (bare string | { label, children, isBranch })
// into a uniform node. `isBranch` decides whether the row gets a chevron;
// anything with real children is a branch regardless.
function toNode(entry, defaultBranch) {
  const raw = typeof entry === 'string' ? { label: entry } : entry;
  const children = (raw.children || []).map((c) => toNode(c, false));
  return {
    id: slug(raw.label),
    label: raw.label,
    children,
    isBranch:
      children.length > 0 ||
      (raw.isBranch === undefined ? !!defaultBranch : !!raw.isBranch)
  };
}

const NAV_TREE = NAV_GROUPS.map((g) => ({
  ...g,
  items: g.items.map((entry) => toNode(entry, g.defaultBranch))
}));

const SETUP_HOME_ID = slug('Setup Home');
const RFQ_TEMPLATE_ID = slug('Request For Quote Template');
const QUOTE_COMPARE_ID = slug('Quote Compare Template');

export default class SetupHome extends LightningElement {
  @track activeNavId = SETUP_HOME_ID;
  @track quickFind = '';
  @track navCollapsed = false;
  // id -> true for branches the admin has opened by hand. Quick Find
  // overrides this while a query is active (every surviving branch is
  // forced open so matches are reachable without extra clicks).
  @track expandedNavIds = {};
  // Add New handoff on both template dashboards: the pre-builder modal
  // first, then the matching wizard with the picked scope seeded in.
  // Each dashboard tracks its own pair so the two flows can't collide.
  @track templateInitOpen = false;
  @track compareWizardOpen = false;
  @track compareSeedLob = null;
  @track compareSeedLoc = null;
  @track rfqInitOpen = false;
  @track rfqWizardOpen = false;
  @track rfqSeedLob = null;
  @track rfqSeedLoc = null;

  get sideColClass() {
    return this.navCollapsed
      ? 'sh__side-col sh__side-col_collapsed'
      : 'sh__side-col';
  }

  get collapseChevronClass() {
    return this.navCollapsed
      ? 'sh__collapse-chevron sh__collapse-chevron_flip'
      : 'sh__collapse-chevron';
  }

  get navExpanded() {
    return this.navCollapsed ? 'false' : 'true';
  }

  get collapseLabel() {
    return this.navCollapsed
      ? 'Expand the Setup menu'
      : 'Collapse the Setup menu';
  }

  get isFiltering() {
    return this.quickFind.trim().length > 0;
  }

  get navGroups() {
    const q = this.quickFind.trim().toLowerCase();
    return NAV_TREE.map((g) => {
      const rows = [];
      g.items.forEach((node) => this._collectRows(node, 0, q, false, rows));
      return {
        id: g.id,
        ariaLabel: g.ariaLabel,
        // The org drops the uppercase section labels while Quick Find is
        // narrowing the tree, so the surviving branch reads as one list.
        heading: q ? '' : g.heading,
        items: rows,
        hasItems: rows.length > 0
      };
    }).filter((g) => g.hasItems);
  }

  // Depth-first preorder walk that emits one flat row per visible node.
  // `forced` is set once an ancestor matched the query, which is what
  // makes a matching branch show its whole subtree.
  _collectRows(node, level, q, forced, out) {
    const selfMatch = !!q && node.label.toLowerCase().includes(q);
    const keepAll = forced || selfMatch;
    const childRows = [];
    node.children.forEach((child) =>
      this._collectRows(child, level + 1, q, keepAll, childRows)
    );
    if (q && !keepAll && childRows.length === 0) return;

    const isExpanded = node.children.length
      ? !!q || !!this.expandedNavIds[node.id]
      : false;
    out.push(this._toRow(node, level, q, isExpanded));
    if (isExpanded) out.push(...childRows);
  }

  _toRow(node, level, q, isExpanded) {
    const isActive = node.id === this.activeNavId;
    const matchAt = q ? node.label.toLowerCase().indexOf(q) : -1;
    const cls = ['sh-nav__row'];
    if (isActive) cls.push('sh-nav__row_active');
    const chevronCls = ['sh-nav__chevron'];
    if (isExpanded) chevronCls.push('sh-nav__chevron_open');
    return {
      id: node.id,
      label: node.label,
      level,
      isParent: node.isBranch,
      hasChildren: node.children.length > 0,
      isExpanded,
      ariaExpanded: isExpanded ? 'true' : 'false',
      ariaSelected: isActive ? 'true' : 'false',
      ariaLevel: String(level + 1),
      cls: cls.join(' '),
      chevronCls: chevronCls.join(' '),
      levelStyle: `--sh-nav-level: ${level};`,
      // Only the first occurrence is marked, which is what the org does.
      hasMatch: matchAt >= 0,
      matchBefore: matchAt >= 0 ? node.label.slice(0, matchAt) : '',
      matchText:
        matchAt >= 0 ? node.label.slice(matchAt, matchAt + q.length) : '',
      matchAfter: matchAt >= 0 ? node.label.slice(matchAt + q.length) : ''
    };
  }

  // ── Canvas routing ────────────────────────────────────────────
  // The two Quote Management leaves replace the home canvas with the
  // templates dashboard the Setup workspace shows on its landing view.
  // Only the landing panel is reproduced: header copy plus the list
  // component. The workspace's own rail, "Setup" heading and category
  // cards are deliberately left out, because this page's sidebar is
  // the only Setup navigation.
  get isRfqTemplateView() {
    return this.activeNavId === RFQ_TEMPLATE_ID;
  }

  get isQuoteCompareView() {
    return this.activeNavId === QUOTE_COMPARE_ID;
  }

  get isTemplatePanelView() {
    return this.isRfqTemplateView || this.isQuoteCompareView;
  }

  get canvasClass() {
    return this.isTemplatePanelView
      ? 'sh__canvas sh__canvas_panel'
      : 'sh__canvas';
  }

  // Header copy is lifted verbatim from c-insurance-setup-workspace's
  // landingTitle / landingSub getters so both entry points into the
  // dashboards read identically.
  get landingTitle() {
    return this.isQuoteCompareView
      ? 'Comparison Templates'
      : 'RFQ Templates';
  }

  get landingSub() {
    return this.isQuoteCompareView
      ? 'Pick an existing comparison template to edit, or create a new one.'
      : 'Pick an existing RFQ template to edit, or create a new one.';
  }

  get goalCards() {
    return GOAL_CARDS.map((c) => ({
      ...c,
      hasPill: !!c.pill,
      categoryMarkClass: `sh-card__cat-mark sh-card__cat-mark_${c.categoryTone}`
    }));
  }

  get recentItems() {
    return RECENT_ITEMS.map((r) => ({ ...r, hasObject: !!r.object }));
  }

  handleQuickFind(event) {
    this.quickFind = event.target.value || '';
  }

  handleNavToggleCollapse() {
    this.navCollapsed = !this.navCollapsed;
  }

  handleNavClick(event) {
    event.preventDefault();
    const { id, children } = event.currentTarget.dataset;
    if (!id) return;
    this.activeNavId = id;
    if (children === 'true' && !this.isFiltering) {
      this.expandedNavIds = {
        ...this.expandedNavIds,
        [id]: !this.expandedNavIds[id]
      };
    }
  }

  // Both dashboards bubble `templatepick` (Edit) and `templatenew`
  // (Add New). Edit is out of scope here: in
  // c-insurance-setup-workspace it hydrates the builder off a saved
  // record and then hands over to that shell's pipeline column, which
  // is the nested navigation this page must not render.
  handleTemplatePick() {
    // Intentional no-op. Edit is tracked separately.
  }

  // Both dashboards now follow the same two beats as the workspace's
  // handleRfqTemplateNew / handleComparisonTemplateNew:
  // c-template-init-modal captures the LOB/LOC scope, then the picked
  // pair is seeded into the matching wizard. Each wizard carries its
  // own stepper, footer and publish, so no pipeline column is needed.
  handleRfqTemplateNew() {
    this.rfqInitOpen = true;
  }

  handleRfqInitContinue(event) {
    const detail = (event && event.detail) || {};
    this.rfqSeedLob = detail.lob || null;
    this.rfqSeedLoc = detail.loc || null;
    this.rfqInitOpen = false;
    this.rfqWizardOpen = true;
  }

  handleRfqInitCancel() {
    this.rfqInitOpen = false;
  }

  handleRfqConfigurationSave() {
    this._closeRfqWizard();
  }

  handleRfqWizardClose() {
    this._closeRfqWizard();
  }

  _closeRfqWizard() {
    this.rfqWizardOpen = false;
    this.rfqSeedLob = null;
    this.rfqSeedLoc = null;
  }

  handleComparisonTemplateNew() {
    this.templateInitOpen = true;
  }

  handleTemplateInitContinue(event) {
    const detail = (event && event.detail) || {};
    this.compareSeedLob = detail.lob || null;
    this.compareSeedLoc = detail.loc || null;
    this.templateInitOpen = false;
    this.compareWizardOpen = true;
  }

  handleTemplateInitCancel() {
    this.templateInitOpen = false;
  }

  // The wizard writes into data/comparisonTemplates itself and closes
  // on publish. Dropping the mount brings the dashboard back, and the
  // fresh list instance reads the updated catalog so the new tile is
  // there, which is what the workspace's return-to-dashboard does.
  handleConfigurationSave() {
    this._closeCompareWizard();
  }

  handleCompareWizardClose() {
    this._closeCompareWizard();
  }

  _closeCompareWizard() {
    this.compareWizardOpen = false;
    this.compareSeedLob = null;
    this.compareSeedLoc = null;
  }

  preventDefault(event) {
    event.preventDefault();
  }

  // The waffle is the org's own way out of Setup. Non-bubbling to match
  // c-agentforce-setup, so only c-account-record-page reacts and the
  // workspace tab strip comes back.
  handleExit() {
    this.dispatchEvent(new CustomEvent('close'));
  }
}
