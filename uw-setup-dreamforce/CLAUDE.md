# UW Setup V2 — Context for Claude

A refreshed, React-based rebuild of the underwriting workbench Setup app. Replaces the vanilla-HTML/CSS/JS Setup that lived at `../UW Front End/public/setup/`. Same data model, same `data/setup/config.json` shape — new UI styled with SLDS 2 design tokens and a custom component library.

**Sibling project (do not touch from here):** `../UW Front End/` is the original runtime workbench plus the legacy Setup. This project is the new Setup only — there is no React workbench here. If a request implies changes to the runtime experience (Submissions list, record page, demo flow, step changer), it belongs in `../UW Front End/`, not this repo.

## Stack
- Vite 5 + React 18 + TypeScript (strict)
- React Router v6 (BrowserRouter)
- SLDS 2 design tokens authored as CSS custom properties — **no `@salesforce/design-system-react` and no SLDS 1 CSS framework**
- No backend; persistence is a Vite middleware that reads/writes `data/setup/config.json`
- No test runner configured. Verify changes with `npx tsc --noEmit` and `npx vite build`.

## Run / verify
- `npm run dev` — Vite dev server on port **3001**
- `npm run build` — production build (TS check + Vite build)
- `npm run preview` — preview the built bundle
- `npx tsc --noEmit` — type check only

## Repo layout
```
UW-Setup-V2/
  data/setup/config.json        Single source of truth for all configuration. Schema mirrors parent.
  vite.config.ts                Vite config + `configApiPlugin` middleware for /api/setup/config (GET/POST)
  index.html                    Vite entry; mounts <App />
  src/
    main.tsx                    createRoot + global.css import
    App.tsx                     <ConfigProvider> + <BrowserRouter> + all <Route>s
    types/config.ts             TypeScript types for every entity in config.json + DEFAULT_CONFIG
    data/
      persistence.ts            loadConfig() / saveConfig() — fetch wrappers around /api/setup/config (200ms debounce on save)
      ConfigContext.tsx         <ConfigProvider> + useConfig() hook (config / loaded / update)
    styles/
      tokens.css                SLDS 2 global tokens (--slds-g-*) + semantic tokens (--slds-s-*)
      global.css                Reset + body defaults; imports tokens.css
    components/
      ui/                       Custom SLDS 2 component library — see "Component library"
        Button, Input, Textarea, Select, Checkbox, Toggle, Modal, Table, Badge,
        Tabs, Card, PageHeader, EmptyState, Icon
        index.ts                Barrel export — import from '@/components/ui'
      shell/
        AppHeader.tsx                Top dark-navy bar (Salesforce / Setup / search / agent_astro button / avatar)
        LeftNav.tsx                  Collapsible nav tree (Insurance > Underwriting > … + Object Management)
        Layout.tsx                   <Outlet /> wrapped in AppHeader + LeftNav + SetupAssistantPanel
        SetupAssistantPanel.tsx      Slide-in agent chat — replayable scripted conversation, option chips, record/condition cards, inline SLDS Standard agent_astro icon. Reads contextual scripts from the store (per-subcategory) or falls back to the default activity-setup conversation.
        setup-assistant-store.ts     Pub-sub for the assistant. State is `{ open, context }`; `openSetupAssistant()` accepts an optional `AssistantContext` ({ id, title, subtitle, script }). The panel resets and replays whenever the context id changes.
        setup-assistant-scripts.ts   Per-subcategory script registry. `AssistantSubject` union enumerates every wired-in section; `buildAssistantContext({ subject, scope?, mode })` returns the `AssistantContext` for either `mode: 'ask'` (descriptive intro + offer to walk through) or `mode: 'steps'` (one-line "Agent will show steps to configure …" placeholder).
    panels/                     One folder per left-nav destination
      GeneralSetup/             Hero landing page → ThreePanelHub with 5 categories in order: Email Ingestion / Submission Context / Document Extraction / Integrations / Run My Day. Submission Context is a single-subcategory tile rendering `SubmissionEntitySection`. The parent-Submission Activities / Stage Management / Reconciliation sections now live in the sibling `SubmissionSettings/` panel but their components (`SubmissionActivitiesSection`, `SubmissionStageManagementSection`, `ReconciliationSection`) still physically live in this folder.
      SubmissionSettings/       Hero landing page → ThreePanelHub with 1 category: Stages and Activities (Activities + Stage Management). Reuses the section components from `GeneralSetup/` and the `gs-page`/`gs-hero` CSS. (Reconciliation and Normalization was removed from this hub; `ReconciliationSection` still physically lives in `GeneralSetup/`.)
      LinesOfBusiness/          LOB hub → ThreePanelHub seeded from Submission `Line_of_Business__c` picklist; per-LOB sections grouped under Activities & Stages, Data Enrichment, Reconciliation. Includes the "+" Add LOB tile that appends a picklist value, and `LobActivitiesSection` (single-column compact-tile list reusing `ActivityTile` + `ActivityEditor`)
      GetStarted/               Placeholder onboarding panel — route still mounted, no longer linked from the nav
      ActiveConfigurations/     Placeholder roll-up panel — route still mounted, no longer linked from the nav
      ObjectManagement/         Submission custom-object fields list + FieldModal (13 data types incl. picklist)
      ActivitiesAndStages/      See "Activities and Stages architecture" below — entity-scoped Activities tab + LOB stage detail page with WYSIWYG path / prompts / tasks-canvas / transition rules. Now reached via the legacy "Setup Entities [Deprecated]" branch.
      IntegrationHub/           4 tabs (Procedures / Connections / Providers / Health) + ConnectionModal + ConnectionDetailPanel + providers.ts (13-vendor hardcoded catalog)
      DataEnrichment/           LOB→Group→Field WYSIWYG editor + definitions table + DefinitionModal + seed.ts (canonical 2-LOB / 14-category dataset ported from parent)
      DocumentExtraction/       Toggle + templates empty state
      Reconciliation/           Entities / Coverages / Hierarchies tabs + HierarchyDetailPanel
      RunMyDay/                 Playbook list + 3-step PlaybookWizard (Define / WYSIWYG configure / Activate); Group / Insight / Action libraries are persisted but no longer on a dedicated tab
      EmailToSubmission/        Settings panel + RoutingFormPanel
      SubmissionAssignment/     Rules list + AssignmentRuleDetailPanel + RuleEntryFormPanel (criteria builder)
    components/
      ThreePanelHub.tsx         Reusable category → master/detail hub used by GeneralSetup and LinesOfBusiness. Two-mode (landing grid ↔ working master/detail) with mirrored push transitions. Supports per-subcategory `group` for headed master nav, an optional `addCard` for inline create tiles (dashed "+"), and an `info` block per subcategory that drives the per-section "Ask" button + empty-state illustration/CTA (see "Setup Assistant").
```

## Persistence model
- **Single JSON file**, `data/setup/config.json`. Schema documented in `src/types/config.ts` (`SetupConfig` interface). Schema is bit-identical to the parent project's so configs can be copied between them.
- **One way in:** `useConfig()` hook returns `{ config, loaded, update }`. Always mutate via `update(prev => next)` — never write to `config` directly. The provider serializes the new state and POSTs it to `/api/setup/config` (debounced 200ms).
- **API:** `vite.config.ts` registers a middleware on `/api/setup/config` that handles GET (read) and POST/PUT (write). The middleware is dev-only — for production, replace it with a real backend or static `config.json` + a separate save service.
- **No localStorage.** This was deliberate — the parent project mixes localStorage and JSON file; we picked file-only to avoid the migration dance.
- **`nextXxxId` counters** in `SetupConfig` must be bumped whenever a new row is added. Pattern: `id: prev.nextXxxId, ... ; nextXxxId: prev.nextXxxId + 1`. Don't generate IDs from `Date.now()` or `Math.random()` — collisions break referential integrity (e.g., `playbooks[].insights[].libraryId → rmdInsightLibrary[].id`).

## SLDS 2 styling hooks
The styling hooks are sourced from the official **`@salesforce-ux/design-system-2`** npm package (the same one the Salesforce Design System 2 Starter Kit uses). This is the source of truth — do not invent hook names.

### Where the tokens come from
- **Package:** `@salesforce-ux/design-system-2`
- **Bundle:** `dist/css/bundled/slds2.cosmos.css` (~26k lines) — imported once at the top of `src/main.tsx`. Contains every real `--slds-g-*` global and `--slds-c-{component}-*` hook the spec defines.
- **Theme variants** (also shipped, not currently loaded): `slds2.lightning-blue.css`, plus `dist/css/modular/slds2.{base,theme.cosmos,theme.lightning-blue,scoped.base,scoped.cosmos}.css` for scoped or split bundles.
- **Compat shim:** `src/styles/tokens.css` only patches a handful of legacy names this app referenced before the package was wired up. Do not extend it — use the real tokens directly.

### Tier 1 — Real global tokens (`--slds-g-*`)
Authoritative names you can rely on (verified against the package):

- **Surface:** `--slds-g-color-surface-{1,2,3}`, `--slds-g-color-surface-container-{1,2,3}`, `--slds-g-color-surface-inverse-{1,2}`, `--slds-g-color-surface-container-inverse-{1,2}`
- **On-surface (text/icon):** `--slds-g-color-on-surface-{1,2,3}`, `--slds-g-color-on-surface-inverse-{1,2}`
- **Borders:** `--slds-g-color-border-{1,2}`, `--slds-g-color-border-{accent,disabled,error,inverse,success,warning}-{1,2}`
- **Accent (brand):** `--slds-g-color-accent-{1,2,3}`, `--slds-g-color-accent-{container,dark,light}-{1,2}`, `--slds-g-color-on-accent-{1,2}`, `--slds-g-color-on-accent-container-{1,2}`
- **Status:** `--slds-g-color-{success,warning,error,info}-{1,2}` and `…-container-{1,2}`, `--slds-g-color-on-{success,warning,error,info}-container-{1,2}`
- **Disabled:** `--slds-g-color-disabled-{1,2}`, `--slds-g-color-disabled-container-{1,2}`
- **Palette (raw):** `--slds-g-color-{neutral,brand,error,warning,success}-base-{0,10,15,20,30,40,45,50,55,60,65,70,80,90,95,100}`
- **Spacing:** `--slds-g-spacing-{1..12}`
- **Sizing:** `--slds-g-sizing-{1..16}`, `--slds-g-sizing-border-{1..4}`, `--slds-g-sizing-base`
- **Radius:** `--slds-g-radius-border-{1,2,3,4,circle,pill}`
- **Typography:** `--slds-g-font-family-{base,monospace}`, `--slds-g-font-scale-{neg-2,neg-1,base,1,2,3,4,6,7}`, `--slds-g-font-weight-{4,5,6,7}`, `--slds-g-font-lineheight-{1..6,base}`
- **Shadow:** `--slds-g-shadow-{1..6}`, `--slds-g-shadow-{block-start,block-end,inline-start,inline-end}-{1..4}`

There is **no `--slds-g-color-focus-*` or `--slds-g-shadow-focus-ring`** in real SLDS 2 — focus rings are per-component, defined inside `--slds-c-{component}-shadow-focus`.

### Tier 2 — Real component styling hooks (`--slds-c-*`)
Each SLDS 2 component defines its own set. Confirmed names this app uses:

- **Button:** `--slds-c-button-{color-background,color-background-hover,color-background-active,color-border,color-border-hover,color-border-active,text-color,text-color-hover,text-color-active,radius-border,sizing-border,spacing-block-{start,end},spacing-inline-{start,end},font-weight,shadow,shadow-focus}`. **Variants are sub-namespaced:** `--slds-c-button-{brand,neutral,destructive,inverse,success}-{color-background,color-background-hover,color-background-active,color-border,color-border-hover,text-color,text-color-hover,text-color-active}`.
- **Input:** `--slds-c-input-{color-background,color-background-focus,color-border,color-border-focus,text-color,text-color-focus,radius-border,shadow,shadow-focus,spacing-inline-{start,end}}`.
- **Select:** `--slds-c-select-{color-background,color-background-focus,color-border,color-border-focus,text-color,text-color-focus,radius-border,shadow}`.
- **Checkbox:** `--slds-c-checkbox-{color-background,color-background-checked,color-border,color-border-checked,color-border-focus,radius-border,shadow,shadow-focus}`.
- **Checkbox-Toggle:** `--slds-c-checkbox-toggle-{color-background,color-background-hover,color-background-checked-focus,color-border,color-border-hover,switch-color-background,switch-color-background-checked,mark-color-foreground,radius-border,shadow}`. (Note: SLDS 2's toggle namespace is `checkbox-toggle`, not `toggle`.)
- **Modal:** `--slds-c-modal-{color-background,color-border,radius-border,sizing-border,text-color,heading-{font-size,font-weight}}` plus `--slds-c-modal-{header,content,footer}-{color-background,text-color,spacing-block-{start,end},spacing-inline-{start,end}}`.
- **Card:** `--slds-c-card-{color-background,color-border,text-color,radius-border,sizing-border,shadow,heading-{font-size,font-weight}}` plus `--slds-c-card-{header,body,footer}-spacing-{block,inline}-{start,end}` and `--slds-c-card-footer-{color-border,sizing-border,font-size}`.
- **Badge:** `--slds-c-badge-{color-background,color-border,color-foreground,text-color,radius-border,sizing-border,font-size,font-weight,font-line-height,spacing-{block,inline}-{start,end}}` plus `--slds-c-badge-{inverse,lightest}-color-{background,border}`.
- **Tabs:** `--slds-c-tabs-list-{color-border,sizing-border}` and `--slds-c-tabs-item-{color-foreground,color-foreground-active,color-foreground-hover,text-color,text-color-active,color-border-active,color-border-hover,font-{size,weight,weight-active,lineheight},sizing-height,indicator-{color-background,sizing-height,sizing-height-active,sizing-height-hover},spacing-{block,inline}-{start,end}}`.

Components I built that **don't have an SLDS 2 hook spec** (because SLDS 2 doesn't ship them): `PageHeader`, `EmptyState`, `Table` (SLDS 2's `data-table` exists but assumes its own DOM). These consume globals only.

### Tier 3 — Per-instance overrides
Override hooks at the call site, never restyle component selectors:

```tsx
// One special button — no class needed
<Button style={{ '--slds-c-button-brand-color-background': 'rebeccapurple' } as React.CSSProperties}>
  Special
</Button>
```

Or scope an override to a region with a wrapper class:
```css
.checkout-area { --slds-c-button-brand-color-background: var(--brand-checkout); }
```

### Rules
- **Use real hook names only.** If you need a hook that isn't in the package, you need a different component or a wrapper — don't invent names.
- **Variants set sub-namespaced hooks first**, then mirror them onto the base hooks so the rules read once. See `Button.css` for the canonical pattern.
- **Panels and shell consume globals only** (`--slds-g-color-on-surface-2` etc.). They never reach into a component's hooks from outside.
- **No raw hex.** If a value isn't a real SLDS 2 global, fall back to the `--slds-g-color-*-base-*` palette — those are also real.
- **Adding a new component?** First check if SLDS 2 already defines it: `ls node_modules/@salesforce-ux/design-system-2/dist/components/`. If yes, mirror its hooks. If no, document the new component's hooks at the top of its CSS so users have a contract.

### Verifying a hook name is real
```bash
grep -roEh '--slds-c-{component}-[a-z0-9-]+' \
  node_modules/@salesforce-ux/design-system-2/dist/components/{component}/ \
  | sort -u
```

## Component library (`src/components/ui/`)
- Pure React, pure CSS — no UI library dependencies.
- One component per file with a co-located `<Component>.css`. Class names are prefixed `slds2-` to avoid collisions.
- **Always import from the barrel:** `import { Button, Input, Card } from '@/components/ui'` — don't reach into individual files.
- **Path alias `@/`** maps to `src/` (configured in both `tsconfig.json` and `vite.config.ts`).
- Components accept `className` for additive styling but have no theming props beyond `variant`/`size`/`tone` enums. Want a 6th button variant? Add it to `Button.tsx` + `Button.css`, don't compose external classes.
- `Modal` portals to `document.body`, traps `Escape`, locks body scroll. Use it; don't write your own overlay.
- `Table<T>` is generic — pass `columns: Column<T>[]`, `rows: T[]`, and `rowKey: (row) => string|number`. Columns use a `render` function, not a `dataKey`. Empty state is built in via the `empty` prop.
- `Icon` ships ~25 path-only SVGs by name. New icon? Add it to the `PATHS` map in `Icon.tsx` rather than dropping inline `<svg>` everywhere.
- **Never use a native `<select>` for a selection box.** The browser's default option list can't be styled and looks foreign against the app. Use the custom `Dropdown` component (`src/components/ui/Dropdown.tsx`) instead — a portal-rendered menu (fixed position, escapes modal/overflow clipping) styled with SLDS 2 globals. Props: `value`, `onChange(value)`, and either `options: DropdownOption[]` (flat) or `groups: DropdownOptionGroup[]` (with optgroup-style headers — pass an empty `label` to omit a group's header). Also supports `placeholder`, `disabled`, `fullWidth`, `aria-label`. The bare `Select` component still exists for legacy call sites, but new selection UIs and any rework should use `Dropdown`.

## Routing
- Single `BrowserRouter` in `App.tsx` with all routes inside one `<Layout />` parent.
- Route map (kept in sync with `LeftNav.tsx`):
  ```
  /                              → redirect to /get-started
  /get-started                   Get Started (route exists, no longer in nav)
  /active-configurations         Active Configurations (route exists, no longer in nav)
  /general-setup                 General Setup hub (landing → category → master/detail)
  /submission-settings           Submission Settings hub (Stages and Activities / Reconciliation and Normalization)
  /lines-of-business             Lines of Business hub (LOB landing → per-LOB sections)
  /activities                    Activities and Stages
  /activities/stm/:id            Submission activity config detail
  /activities/lob/:id            LOB activity config detail (stage navigator on left)
  /integration-hub               Integration Hub (4 tabs)
  /integration-hub/connection/:id  Connection detail
  /data-enrichment               Definitions list
  /data-enrichment/:id           Definition detail
  /document-extraction           Document Extraction
  /reconciliation                Entities / Coverages / Hierarchies
  /reconciliation/hierarchy/:id  Hierarchy tree detail
  /run-my-day                    redirect to /general-setup
  /run-my-day/playbooks          Playbook list (legacy)
  /email-to-submission           Settings page
  /email-to-submission/routing/:id  Routing address form
  /submission-assignment         Rules list
  /submission-assignment/:id     Rule detail
  /submission-assignment/:id/entry/:entryId  Rule entry form
  /object-management             Submission fields list
  *                              → redirect to /get-started
  ```
- Left nav structure: Insurance → Underwriting → General Setup, Submission Settings, Lines of Business, **Setup Entities [Deprecated]** (Activities and Stages, Integration Hub, Data Enrichment, Document Extraction, Reconciliation And Normalization, Submission Ingestion → Email to Submission / Submission Assignment Rules) — followed by Object Management at the root. Get Started and Active Configurations are intentionally not linked.
- Adding a route: register it in `App.tsx`, link to it from `LeftNav.tsx` if it should appear in the nav, navigate via `useNavigate()` not anchor `href`s (links use `<a onClick>` in tables — keep the pattern consistent for accessibility).

## Coding rules and gotchas
- **No new files unless asked.** Edit existing ones.
- **No comments unless the *why* is non-obvious.** Don't narrate code.
- **Inline styles are acceptable** for layout-specific styles inside panels (gap, grid, one-off paddings). Use them — don't create a CSS module per panel. But anything reusable belongs in `src/components/ui/` with its own CSS file.
- **Update via `update()` only.** `update((prev) => ({ ...prev, ... }))` — always spread the previous state, never replace it; missing keys break the API round-trip.
- **Bump `nextXxxId`** when inserting. Don't reuse deleted IDs.
- **Strict TS.** No `any`, no implicit `any`. Use `Record<string, T>` or proper unions.
- **No SSR / hydration concerns** — this is a pure SPA. No `mounted` flag pattern needed.
- **Bundle size discipline.** No CSS-in-JS libraries. No utility frameworks (Tailwind, Emotion). No animation libraries. The whole app is currently ~340 KB JS / 96 KB gzipped + ~125 KB CSS / 17 KB gzipped — keep it lean.
- **Don't reach for `@salesforce/design-system-react` or `@salesforce-ux/design-system`.** That's SLDS 1 and the whole point of this rebuild is to be SLDS 2 token-driven without the legacy CSS payload.

## Activities and Stages architecture
This panel is the most layered in the app. Three top-level concepts — `ReusableActivity` (library), `ActivityConfig` aka **STM** (submission stage container), `StageConfig` aka **SC** (LOB stage container) — and a separate stage-keyed map `activitiesData` / `stmActivitiesData` that holds the actual task instances per stage. The page is split into two tabs (Activities, Stage Management) and one detail page per LOB config.

**Activities tab** (`ActivitiesEntityEditor.tsx`): two-column WYSIWYG.
- Left column: an Entity tree — `Parent Submission` (selectable), then a non-clickable `Lines of Submission` heading, then one entry per LOB pulled from the Submission `Line_of_Business__c` picklist.
- Middle column: tile list of activities scoped to the focused entity. Search by name + local scroll.
- Right column (only when an activity is selected): `ActivityEditor.tsx` with the 5 process types ported from the old setup — Flow, Integration Procedure, Omniscript, Agent, Enrichment Definition. The Enrichment Definition variant has cascading `LOB → Category → Definition` selectors; LOB is **derived from the activity's scope** (not user-editable) and shown as a read-only indicator.

**LOB Activity Configuration detail page** (`ScDetailPanel.tsx` → `LobStageEditor.tsx`):
- Tight header: back-arrow icon + config name only.
- Collapsible **General** card (5 fields: Name, LOB, Active, Start Date, End Date). Read-only by default with an Edit button → swaps to inputs with Save/Cancel and validation.
- **Configuration Prompt** card — top-level prompt that applies across every stage in the configuration.
- **Stage path** — chevron-shaped tabs of stage names. Drag handle on each chevron to reorder; × button to remove. The Add button opens a checkbox popover sourced from the Submission `Stage__c` picklist (any picklist value not already on the configuration), with multi-select Add/Cancel.
- **20:80 split** below the path with three sub-tabs in the left rail (15% in real terms): **Tasks**, **Transition Rules**, **Stage Prompt**.
  - **Tasks** = `TasksPane.tsx`: WYSIWYG canvas (left) + horizontally-collapsible Activities palette (right).
    - Canvas columns are computed by `task-layout.ts` via `bucketByColumns(tasks)`: column = `1 + max(referenced-task column)`. Conditional tasks reference `triggerRules.conditions[].activityId`; Manual tasks reference `availabilityRules` instead.
    - SVG connector layer sits inside the columns container so paths don't get clipped by horizontal scroll. Cubic bezier with clamped handle length; arrowhead is a polygon at the target's left edge.
    - Drag a palette item onto the canvas → opens `TaskInstanceModal.tsx` (port of the old setup's activity modal): Display Name, Activity reference (read-only), Availability radio (On Stage Change | Conditional + condition rows), Trigger radio (Manual | On Stage Change | Conditional + condition rows), Mandatory checkbox, Button Name (when Manual). Defaults are "On Stage Change" for both Availability and Trigger. Editing a task surfaces a **Delete Task** button in the modal footer.
    - Task tiles on the canvas are minimal — name + a single "Available on stage change" / "Available conditionally" line. Manual tasks get an inline "Manual" badge.
    - Activities palette is searchable; items show only the name by default and expand inline to reveal description / process chip / target.
  - **Transition Rules** = list of `{ field, operator, value }` rows (ANDed). Field options come from `config.fields` labels.
  - **Stage Prompt** = single textarea per stage; persists to `cfg.stagePrompts[stageName]`.

**Persistence keys (gotcha):**
- `cfg.stagePrompts` and `cfg.stageTransitionRules` are keyed by **stage name**, so reordering / renaming stages preserves the values.
- `config.activitiesData` is still keyed by stage **index** (`{cfgId}:{stageIdx}`). Reordering stages will scramble which tasks belong to which stage. If you migrate this, also touch `task-layout.ts` and the `stageKey` plumbing in `TasksPane.tsx`.
- `ReusableActivity.scope` is `'Parent Submission' | { lob: string }` (the legacy `'Lines of Submission'` literal still appears in the type union for compat but isn't producible from the UI).
- A task instance's `activityRefId` points to a `ReusableActivity` in the library. The instance carries its own `nameOverride`, `availability(Rules)`, `trigger(Rules)`, `mandatory`, `buttonName` — overrides on top of the library entry.

## Setup Assistant (slide-in agent chat)
Mounted once globally in `Layout.tsx` so any button can open it without prop-drilling.

- **Trigger surfaces:** the agent_astro button in `AppHeader.tsx` (default conversation), the "Launch Setup Assistant" button on the General Setup + LOB hero cards (default conversation), the per-subcategory "Ask" button in `ThreePanelHub.tsx` (contextual conversation), and the empty-state "Show step-by-step process" CTA on subcategories whose `info.isEmpty` is true (also contextual, but mode `'steps'`).
- **Replaceable content.** `setup-assistant-store.ts` exports an `AssistantContext` shape (`{ id, title?, subtitle?, script }`). Calling `openSetupAssistant()` with no args plays the long default activity-setup conversation; calling it with a context replaces the panel header title + script. The panel keys on `context.id` so back-to-back opens for the same subject don't replay; switching subjects resets and replays.
- **Per-section scripts.** `setup-assistant-scripts.ts` owns the registry. Add a new subject by extending the `AssistantSubject` union and adding `{ title, intro }` under `SUBJECTS`. `buildAssistantContext({ subject, scope?, mode })` produces the context — `mode: 'ask'` plays the descriptive intro followed by an offer to walk through configuration; `mode: 'steps'` shows a one-line placeholder ("Agent will show steps to configure …"). Hub callers don't write scripts directly; they pass `info: { subject, scope?, isEmpty? }` on each subcategory.
- **Hub `info` contract.** Subcategories that ship a `render()` of their own should NOT set `isEmpty` here — each section component has its own empty-state handling that knows its data shape. Only set `isEmpty: true` for placeholder slots (no `render()`). Earlier we tried computing `isEmpty` from live config in the panel; that hid existing data because filters like `stageConfigs[].lob === 'Property'` don't match (stage configs use `recordType` and labels can drift between e.g. "Property" vs "Commercial Property"). Don't reintroduce that pattern.
- **Avatar icon is inline SVG.** SLDS 2 ships no raster icons, and external CDNs (`v1.lightningdesignsystem.com/...png`) can be flaky / CORS-restricted in some envs. The official Standard `agent_astro` path is inlined in `AgentforceMark()` (extracted from the SLDS sprite). Header button + Ask button use the same inline path. Don't reintroduce an `<img src="...">` to an external URL.
- **Styling is SLDS 2 token-driven** — surface, border, accent, shadow, radius, typography all come from `--slds-g-*`. Avatar backgrounds use `--slds-g-color-accent-1` / `--slds-g-color-on-accent-1` so they track theme changes. The condition card's monospace formula block uses `--slds-g-color-neutral-base-15` + `--slds-g-color-success-1` for the syntax-highlight effect.
- **Empty-state illustration.** Pure-SVG card-stack drawing in `ThreePanelHub.tsx` (`EmptyIllustration`). All fills come from SLDS globals (`--slds-g-color-surface-1`, `--slds-g-color-brand-base-95`, `--slds-g-color-accent-1`, `--slds-g-color-accent-3`) so it themes automatically.
- **Layout shape:** fixed-position `aside` on the right; `transform: translateX(100%)` when closed, slides in over the page. No body-scroll lock — the panel and main content scroll independently.

## Schema additions
- Adding a new top-level entity?
  1. Add the type to `src/types/config.ts` and include `nextXxxId` counter.
  2. Add defaults to `DEFAULT_CONFIG` so old config files still load.
  3. Add the entity array to `data/setup/config.json` (the `loadConfig()` function deep-merges with `DEFAULT_CONFIG`, so existing files won't break, but the seed should be there).
  4. Build the panel under `src/panels/<EntityName>/`, register the route in `App.tsx`, and link from `LeftNav.tsx`.

## Security / operational rules
- Don't commit `.env`, credentials, or secret files. There are none in the repo.
- `data/setup/config.json` is demo data. Keep it that way — no real broker/insured/PII data ever.
- **Never push to git unless explicitly instructed.** Don't ask after completing work; only push when the user requests it. Confirm the remote and branch before pushing.
- **Default push target is `origin` → `https://git.soma.salesforce.com/nakul-saxena/UW-Setup-V2.git`.** Whenever the user asks to "push" without specifying a remote, push to that URL. Never add or push to a different remote unless the user explicitly names it in the request.
- **Always announce the push target before pushing.** State the remote URL and branch in the message before running `git push` so the user can confirm the destination.
- **Push SSL workaround.** `git.soma.salesforce.com` sits behind a self-signed corporate intermediate, so plain `git push` fails with `SSL certificate problem: self signed certificate in certificate chain`. The fix is to point git at the Salesforce CA bundle at `/Users/nakul.saxena/.claude/certs/salesforce-ca-bundle.pem`. Either run once persistently (`git config --global http.sslCAInfo /Users/nakul.saxena/.claude/certs/salesforce-ca-bundle.pem`) — the sandbox cannot write `~/.gitconfig`, so the user must run this themselves — or push one-shot with `GIT_SSL_CAINFO=/Users/nakul.saxena/.claude/certs/salesforce-ca-bundle.pem git push origin <branch>`. **Never** use `-c http.sslVerify=false` to bypass the check.

## Maintenance
Update this file when:
- A new top-level config entity is added (under "Schema additions").
- A new route appears (under "Routing").
- A new design-token convention is introduced (under "SLDS 2 design tokens").
- The persistence story changes (move off file, add a real backend, etc).
- A new build/test command is added (under "Run / verify").
- A new global UI surface is added — global modals, slide-ins, toasts, etc. (under "Setup Assistant" or a new section like it).

If the change doesn't match one of those buckets, it probably doesn't belong here — keep this file scannable.
