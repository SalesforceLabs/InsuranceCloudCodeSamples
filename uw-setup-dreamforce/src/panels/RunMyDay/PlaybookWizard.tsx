import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Icon, Input, Select, Textarea, Toggle } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type {
  PlaybookGroup,
  PlaybookInsight,
  RmdAction,
  UnderwriterRole,
} from '@/types/config';
import { UNDERWRITER_ROLES } from '@/types/config';
import { GroupIcon, RMD_ICON_KEYS } from './wizard-icons';
import './PlaybookWizard.css';

type Step = 1 | 2 | 3;
type Focus = 'group' | 'insight' | 'action' | null;

interface Selection {
  groupIdx: number | null;
  insightIdx: number | null;
  focus: Focus;
}

interface WizardState {
  step: Step;
  editingId: number | null;
  name: string;
  api: string;
  description: string;
  role: UnderwriterRole | '';
  groups: PlaybookGroup[];
  active: boolean;
  selection: Selection;
}

const RMD_INSIGHT_FLOWS = [
  'Renewal_Expiring_Flow',
  'Quote_Followup_Flow',
  'New_Submission_Flow',
  'Loss_Run_Review_Flow',
  'Compliance_Check_Flow',
];

const RMD_CALCULATED_INSIGHTS = [
  'High_Priority_Renewals',
  'Stalled_Quotes',
  'New_Business_Opportunities',
  'Pending_Compliance_Reviews',
  'Recent_Loss_Activity',
];

interface Props {
  open: boolean;
  editingId: number | null;
  onClose: () => void;
}

export function PlaybookWizard({ open, editingId, onClose }: Props) {
  const { config, update } = useConfig();
  const [state, setState] = useState<WizardState | null>(null);

  useEffect(() => {
    if (!open) {
      setState(null);
      return;
    }
    const existing = editingId ? config.playbooks.find((p) => p.id === editingId) : null;
    setState({
      step: 1,
      editingId: editingId ?? null,
      name: existing?.name ?? '',
      api: existing?.api ?? '',
      description: existing?.description ?? '',
      role: (existing?.role as UnderwriterRole | '' | undefined) ?? '',
      groups: existing ? JSON.parse(JSON.stringify(existing.groups ?? [])) : [],
      active: existing ? existing.active : true,
      selection: { groupIdx: null, insightIdx: null, focus: null },
    });
  }, [open, editingId, config.playbooks]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !state) return null;

  const setStep = (step: Step) => setState((s) => (s ? { ...s, step } : s));

  const onNext = () => {
    if (state.step === 1) {
      if (!state.name.trim()) { alert('Configuration Name is required.'); return; }
      if (!state.api.trim()) { alert('API Name is required.'); return; }
      setStep(2);
      return;
    }
    if (state.step === 2) {
      if (state.groups.length === 0) {
        if (!confirm('No groups have been added. Continue anyway?')) return;
      }
      setStep(3);
      return;
    }
    if (state.step === 3) {
      commit();
    }
  };

  const onBack = () => { if (state.step > 1) setStep((state.step - 1) as Step); };

  const commit = () => {
    update((prev) => {
      const newGroups = [...prev.rmdGroupLibrary];
      let nextGroupId = prev.nextRmdGroupId;
      const newInsights = [...prev.rmdInsightLibrary];
      let nextInsightId = prev.nextRmdInsightId;
      const newActions = [...prev.rmdActionLibrary];
      let nextActionId = prev.nextRmdActionId;

      const promotedGroups = state.groups.map((g) => {
        let libraryId = g.libraryId;
        if (!libraryId && g.name && g.api) {
          const found = newGroups.find((x) => x.api === g.api);
          if (found) libraryId = found.id;
          else {
            libraryId = nextGroupId++;
            newGroups.push({ id: libraryId, name: g.name, api: g.api, icon: g.icon, order: g.order });
          }
        }
        const promotedInsights = (g.insights ?? []).map((ins) => {
          let insLibId = ins.libraryId;
          if (!insLibId && ins.name && ins.api) {
            const found = newInsights.find((x) => x.api === ins.api);
            if (found) insLibId = found.id;
            else {
              insLibId = nextInsightId++;
              newInsights.push({
                id: insLibId,
                name: ins.name,
                api: ins.api,
                description: ins.description,
                capabilityType: ins.capabilityType,
                capabilityValue: ins.capabilityValue,
                order: ins.order,
              });
            }
          }
          const promotedActions = (ins.actions ?? []).map((act) => {
            let actLibId = (act as RmdAction & { libraryId?: number | null }).libraryId ?? null;
            if (!actLibId && act.name && act.api) {
              const found = newActions.find((x) => x.api === act.api);
              if (found) actLibId = found.id;
              else {
                actLibId = nextActionId++;
                newActions.push({
                  id: actLibId,
                  name: act.name,
                  api: act.api,
                  description: act.description,
                  type: act.type,
                });
              }
            }
            return act;
          });
          return { ...ins, libraryId: insLibId ?? null, actions: promotedActions };
        });
        return { ...g, libraryId: libraryId ?? null, insights: promotedInsights };
      });

      const record = {
        name: state.name.trim(),
        api: state.api.trim(),
        description: state.description.trim(),
        role: state.role as UnderwriterRole | '',
        groups: promotedGroups,
        active: state.active,
      };

      let playbooks = prev.playbooks;
      let nextPlaybookId = prev.nextPlaybookId;
      if (state.editingId) {
        playbooks = prev.playbooks.map((p) =>
          p.id === state.editingId ? { ...p, ...record } : p,
        );
      } else {
        playbooks = [...prev.playbooks, { id: nextPlaybookId++, ...record }];
      }

      return {
        ...prev,
        playbooks,
        nextPlaybookId,
        rmdGroupLibrary: newGroups,
        nextRmdGroupId: nextGroupId,
        rmdInsightLibrary: newInsights,
        nextRmdInsightId: nextInsightId,
        rmdActionLibrary: newActions,
        nextRmdActionId: nextActionId,
      };
    });
    onClose();
  };

  return createPortal(
    <div
      className="rmdw-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rmdw-modal" role="dialog" aria-modal="true">
        <div className="rmdw-header">
          <h2 className="rmdw-title">{state.editingId ? 'Edit Playbook' : 'New Playbook'}</h2>
          <button type="button" className="rmdw-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="rmdw-body">
          <Steps step={state.step} />
          <div className="rmdw-content">
            {state.step === 1 && <Step1 state={state} setState={setState as React.Dispatch<React.SetStateAction<WizardState>>} />}
            {state.step === 2 && <Step2 state={state} setState={setState as React.Dispatch<React.SetStateAction<WizardState>>} />}
            {state.step === 3 && <Step3 state={state} setState={setState as React.Dispatch<React.SetStateAction<WizardState>>} />}
          </div>
        </div>
        <div className="rmdw-footer">
          <Button variant="neutral" onClick={onBack} disabled={state.step === 1}>
            ← Back
          </Button>
          <Button variant={state.step === 3 ? 'brand' : 'neutral'} onClick={onNext}>
            {state.step === 3 ? 'Save' : 'Save & Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Steps({ step }: { step: Step }) {
  const labels = ['Define', 'Configure', 'Activate'];
  return (
    <nav className="rmdw-steps">
      {labels.map((label, i) => {
        const num = (i + 1) as Step;
        const cls =
          num === step
            ? 'rmdw-step rmdw-step--active'
            : num < step
              ? 'rmdw-step rmdw-step--done'
              : 'rmdw-step';
        return (
          <div key={label} className={cls}>
            <div className="rmdw-step-num">{num}</div>
            <div className="rmdw-step-label">{label}</div>
          </div>
        );
      })}
    </nav>
  );
}

// Step 1 — Define
function Step1({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const onName = (v: string) => {
    setState((s) => {
      const next: WizardState = { ...s, name: v };
      if (!s.api) next.api = v.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
      return next;
    });
  };

  return (
    <>
      <h3 className="rmdw-step1-title">Define Your Configuration</h3>
      <Input
        label="Configuration Name"
        required
        value={state.name}
        maxLength={80}
        placeholder="e.g., Wealth Advisor"
        onChange={(e) => onName(e.target.value)}
        fullWidth
      />
      <span className="rmdw-charcount">{state.name.length}/80</span>
      <div style={{ height: 12 }} />
      <Input
        label="API Name"
        required
        value={state.api}
        maxLength={80}
        placeholder="Enter API Name"
        onChange={(e) => set('api', e.target.value)}
        fullWidth
      />
      <span className="rmdw-charcount">{state.api.length}/80</span>
      <div style={{ height: 12 }} />
      <Textarea
        label="Description"
        value={state.description}
        maxLength={500}
        placeholder="Describe the configuration's intended use and target segment..."
        onChange={(e) => set('description', e.target.value)}
        rows={3}
        fullWidth
      />
      <span className="rmdw-charcount">{state.description.length}/500</span>
      <div style={{ height: 12 }} />
      <Select
        label="Role"
        hint="Optional. If set, the playbook applies only to users with this role."
        value={state.role}
        onChange={(e) => set('role', e.target.value as UnderwriterRole | '')}
      >
        <option value="">Any role</option>
        {UNDERWRITER_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </Select>

      <div className="rmdw-config-cols">
        <h4 className="rmdw-config-cols-title">Configuration Columns</h4>
        <p className="rmdw-config-cols-sub">
          Predefined columns that structure the Run My Day experience.
        </p>
        <div className="rmdw-config-cols-card">
          <div className="rmdw-config-row">
            <div className="rmdw-config-num">1</div>
            <div>
              <div className="rmdw-config-name">Group Configuration</div>
              <div className="rmdw-config-desc">
                Top-level categories (e.g., Grow, Retain, Service) that bucket related insights for
                the underwriter.
              </div>
            </div>
          </div>
          <div className="rmdw-config-row">
            <div className="rmdw-config-num">2</div>
            <div>
              <div className="rmdw-config-name">Insight Configuration</div>
              <div className="rmdw-config-desc">
                Filtered views of submissions surfaced inside a group, powered by Flows or
                Calculated Insights.
              </div>
            </div>
          </div>
          <div className="rmdw-config-row">
            <div className="rmdw-config-num">3</div>
            <div>
              <div className="rmdw-config-name">Action Configuration</div>
              <div className="rmdw-config-desc">
                Things the underwriter can do on each submission — platform actions, prompt
                templates, or flows.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Step 2 — Configure
function Step2({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  return (
    <div className="rmdw-step2">
      <Preview state={state} setState={setState} />
      <ConfigPanel state={state} setState={setState} />
    </div>
  );
}

function Preview({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const sel = state.selection;
  const selectedGroup = sel.groupIdx != null ? state.groups[sel.groupIdx] : null;

  const selectGroup = (i: number) =>
    setState((s) => ({ ...s, selection: { groupIdx: i, insightIdx: null, focus: 'group' } }));

  const selectInsight = (i: number) =>
    setState((s) => ({ ...s, selection: { ...s.selection, insightIdx: i, focus: 'insight' } }));

  const openActions = () => {
    if (sel.groupIdx == null || sel.insightIdx == null) return;
    setState((s) => ({ ...s, selection: { ...s.selection, focus: 'action' } }));
  };

  const addGroup = () =>
    setState((s) => {
      const groups = [
        ...s.groups,
        {
          libraryId: null,
          name: '',
          api: '',
          icon: 'briefcase',
          order: s.groups.length + 1,
          insights: [],
        } as PlaybookGroup,
      ];
      return {
        ...s,
        groups,
        selection: { groupIdx: groups.length - 1, insightIdx: null, focus: 'group' },
      };
    });

  const addInsight = () =>
    setState((s) => {
      if (s.selection.groupIdx == null) return s;
      const groups = s.groups.map((g, i) =>
        i === s.selection.groupIdx
          ? {
              ...g,
              insights: [
                ...g.insights,
                {
                  libraryId: null,
                  name: '',
                  api: '',
                  description: '',
                  capabilityType: 'flow' as const,
                  capabilityValue: '',
                  order: g.insights.length + 1,
                  snoozeEnabled: false,
                  dismissEnabled: false,
                  actions: [],
                } as PlaybookInsight,
              ],
            }
          : g,
      );
      return {
        ...s,
        groups,
        selection: {
          ...s.selection,
          insightIdx: groups[s.selection.groupIdx].insights.length - 1,
          focus: 'insight',
        },
      };
    });

  return (
    <div className="rmdw-preview">
      <div className="rmdw-prev-col">
        <h4 className="rmdw-prev-col-title">Groups</h4>
        {state.groups.map((g, i) => (
          <div
            key={i}
            className={`rmdw-prev-item${
              sel.groupIdx === i && sel.focus === 'group' ? ' rmdw-prev-item--selected' : ''
            }`}
            onClick={() => selectGroup(i)}
          >
            <span className="rmdw-prev-item-icon">
              <GroupIcon name={g.icon || 'briefcase'} />
            </span>
            <span style={{ flex: 1, fontWeight: 500 }}>{g.name || `Group ${i + 1}`}</span>
          </div>
        ))}
        <button type="button" className="rmdw-prev-add" onClick={addGroup}>
          + Add Group
        </button>
      </div>

      <div className="rmdw-prev-col">
        <h4 className="rmdw-prev-col-title">Insights</h4>
        {selectedGroup ? (
          <>
            {selectedGroup.insights.map((ins, i) => (
              <div
                key={i}
                className={`rmdw-prev-item rmdw-prev-insight${
                  sel.insightIdx === i && sel.focus === 'insight' ? ' rmdw-prev-item--selected' : ''
                }`}
                onClick={() => selectInsight(i)}
              >
                <div className="rmdw-prev-insight-header">
                  <span className="rmdw-prev-insight-title">{ins.name || `Insight ${i + 1}`}</span>
                  <span className="rmdw-prev-insight-dot" />
                </div>
                <div className="rmdw-prev-bar" />
                <div className="rmdw-prev-bar" />
              </div>
            ))}
            <button type="button" className="rmdw-prev-add" onClick={addInsight}>
              + Add Insight
            </button>
          </>
        ) : (
          <div className="rmdw-prev-empty">Select a group</div>
        )}
      </div>

      <div className="rmdw-prev-col">
        <h4 className="rmdw-prev-col-title">Actions</h4>
        {sel.groupIdx == null || sel.insightIdx == null ? (
          <div className="rmdw-prev-empty">Select an insight</div>
        ) : (
          <div
            className={`rmdw-actions-tile${
              sel.focus === 'action' ? ' rmdw-actions-tile--selected' : ''
            }`}
            onClick={openActions}
          >
            <div className="rmdw-prev-bar" />
            <div className="rmdw-prev-bar" />
            <div className="rmdw-prev-bar" />
            <div className="rmdw-prev-bar" />
            <div className="rmdw-prev-bar" />
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigPanel({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const sel = state.selection;
  if (sel.focus === 'group' && sel.groupIdx != null)
    return <GroupConfig state={state} setState={setState} />;
  if (sel.focus === 'insight' && sel.insightIdx != null)
    return <InsightConfig state={state} setState={setState} />;
  if (sel.focus === 'action' && sel.insightIdx != null)
    return <ActionConfig state={state} setState={setState} />;
  return (
    <div className="rmdw-config-panel">
      <div className="rmdw-cp-empty">
        <Icon name="settings" size={32} />
        <div className="rmdw-cp-empty-title">Select A Group</div>
        <div className="rmdw-cp-empty-sub">
          Click a Group in the preview to open its configuration panel.
        </div>
      </div>
    </div>
  );
}

function GroupConfig({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const { config } = useConfig();
  const idx = state.selection.groupIdx!;
  const group = state.groups[idx];

  const updateField = <K extends keyof PlaybookGroup>(field: K, value: PlaybookGroup[K]) =>
    setState((s) => ({
      ...s,
      groups: s.groups.map((g, i) =>
        i === idx ? { ...g, [field]: value, libraryId: null } : g,
      ),
    }));

  const onPickLibrary = (id: string) => {
    if (!id) {
      updateField('libraryId', null);
      return;
    }
    const lib = config.rmdGroupLibrary.find((g) => g.id === Number(id));
    if (!lib) return;
    setState((s) => ({
      ...s,
      groups: s.groups.map((g, i) =>
        i === idx
          ? {
              ...g,
              libraryId: lib.id,
              name: lib.name,
              api: lib.api,
              icon: lib.icon,
              order: lib.order,
            }
          : g,
      ),
    }));
  };

  const removeGroup = () => {
    if (!confirm('Remove this group from the playbook?')) return;
    setState((s) => ({
      ...s,
      groups: s.groups.filter((_, i) => i !== idx),
      selection: { groupIdx: null, insightIdx: null, focus: null },
    }));
  };

  const addInsight = () =>
    setState((s) => {
      const groups = s.groups.map((g, i) =>
        i === idx
          ? {
              ...g,
              insights: [
                ...g.insights,
                {
                  libraryId: null,
                  name: '',
                  api: '',
                  description: '',
                  capabilityType: 'flow' as const,
                  capabilityValue: '',
                  order: g.insights.length + 1,
                  snoozeEnabled: false,
                  dismissEnabled: false,
                  actions: [],
                },
              ],
            }
          : g,
      );
      return {
        ...s,
        groups,
        selection: {
          ...s.selection,
          insightIdx: groups[idx].insights.length - 1,
          focus: 'insight',
        },
      };
    });

  return (
    <div className="rmdw-config-panel">
      <h3 className="rmdw-cp-title">Configure Group</h3>
      <Select
        label="Select From Existing Groups"
        value={group.libraryId?.toString() ?? ''}
        onChange={(e) => onPickLibrary(e.target.value)}
      >
        <option value="">Select a Group</option>
        {config.rmdGroupLibrary.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </Select>
      <div className="rmdw-cp-divider">Or Create A New Group</div>
      <Input label="Group Name" value={group.name} onChange={(e) => updateField('name', e.target.value)} fullWidth />
      <div style={{ height: 12 }} />
      <Input label="API Name" value={group.api} onChange={(e) => updateField('api', e.target.value)} fullWidth />
      <div style={{ height: 12 }} />
      <Select label="Group Icon" value={group.icon} onChange={(e) => updateField('icon', e.target.value)}>
        {RMD_ICON_KEYS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
      </Select>
      <div style={{ height: 12 }} />
      <Input
        label="Group Order"
        type="number"
        value={group.order || ''}
        onChange={(e) => updateField('order', Number(e.target.value) || 0)}
        fullWidth
      />
      <div style={{ marginTop: 14 }}>
        <Button variant="destructive" onClick={removeGroup} fullWidth iconLeading={<Icon name="trash" size={14} />}>
          Remove Group
        </Button>
      </div>
      <div className="rmdw-cp-next">
        Next: <a onClick={addInsight}>Configure Insights →</a>
      </div>
    </div>
  );
}

function InsightConfig({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const { config } = useConfig();
  const sel = state.selection;
  const groupIdx = sel.groupIdx!;
  const insightIdx = sel.insightIdx!;
  const insight = state.groups[groupIdx].insights[insightIdx];

  const updateField = <K extends keyof PlaybookInsight>(field: K, value: PlaybookInsight[K]) =>
    setState((s) => ({
      ...s,
      groups: s.groups.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              insights: g.insights.map((ins, j) =>
                j === insightIdx ? { ...ins, [field]: value, libraryId: null } : ins,
              ),
            }
          : g,
      ),
    }));

  const onPickLibrary = (id: string) => {
    if (!id) {
      updateField('libraryId', null);
      return;
    }
    const lib = config.rmdInsightLibrary.find((i) => i.id === Number(id));
    if (!lib) return;
    setState((s) => ({
      ...s,
      groups: s.groups.map((g, gi) =>
        gi === groupIdx
          ? {
              ...g,
              insights: g.insights.map((ins, ji) =>
                ji === insightIdx
                  ? {
                      ...ins,
                      libraryId: lib.id,
                      name: lib.name,
                      api: lib.api,
                      description: lib.description,
                      capabilityType: lib.capabilityType,
                      capabilityValue: lib.capabilityValue,
                      order: lib.order,
                    }
                  : ins,
              ),
            }
          : g,
      ),
    }));
  };

  const onCapability = (type: 'flow' | 'calculated', value: string) => {
    if (!value) return;
    setState((s) => ({
      ...s,
      groups: s.groups.map((g, gi) =>
        gi === groupIdx
          ? {
              ...g,
              insights: g.insights.map((ins, ji) =>
                ji === insightIdx
                  ? { ...ins, capabilityType: type, capabilityValue: value, libraryId: null }
                  : ins,
              ),
            }
          : g,
      ),
    }));
  };

  const removeInsight = () => {
    if (!confirm('Remove this insight from the group?')) return;
    setState((s) => ({
      ...s,
      groups: s.groups.map((g, gi) =>
        gi === groupIdx ? { ...g, insights: g.insights.filter((_, j) => j !== insightIdx) } : g,
      ),
      selection: { ...s.selection, insightIdx: null, focus: 'group' },
    }));
  };

  const goToActions = () =>
    setState((s) => ({ ...s, selection: { ...s.selection, focus: 'action' } }));

  return (
    <div className="rmdw-config-panel">
      <h3 className="rmdw-cp-title">Configure Insight</h3>
      <Select
        label="Select From Existing Insight"
        value={insight.libraryId?.toString() ?? ''}
        onChange={(e) => onPickLibrary(e.target.value)}
      >
        <option value="">Select Insight</option>
        {config.rmdInsightLibrary.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </Select>
      <div className="rmdw-cp-divider">Or create a new insight</div>
      <Input label="Insight Name" value={insight.name} onChange={(e) => updateField('name', e.target.value)} fullWidth />
      <div style={{ height: 12 }} />
      <Input label="API Name" value={insight.api} onChange={(e) => updateField('api', e.target.value)} fullWidth />
      <div style={{ height: 12 }} />
      <Input label="Description" value={insight.description} onChange={(e) => updateField('description', e.target.value)} fullWidth />
      <div style={{ height: 12 }} />
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--slds-g-color-on-surface-2)' }}>
        Insight Capability
      </label>
      <div className="rmdw-grid-2" style={{ marginTop: 6 }}>
        <Select
          value={insight.capabilityType === 'flow' ? insight.capabilityValue : ''}
          onChange={(e) => onCapability('flow', e.target.value)}
        >
          <option value="">Select Flow</option>
          {RMD_INSIGHT_FLOWS.map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
        <Select
          value={insight.capabilityType === 'calculated' ? insight.capabilityValue : ''}
          onChange={(e) => onCapability('calculated', e.target.value)}
        >
          <option value="">Select Calculated Insight</option>
          {RMD_CALCULATED_INSIGHTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>
      <span className="rmdw-charcount">Select from Flows or Calculated Insights.</span>
      <div style={{ height: 12 }} />
      <Input
        label="Display order"
        type="number"
        value={insight.order || ''}
        onChange={(e) => updateField('order', Number(e.target.value) || 0)}
        fullWidth
      />
      <div style={{ marginTop: 14 }}>
        <Button variant="destructive" onClick={removeInsight} fullWidth iconLeading={<Icon name="trash" size={14} />}>
          Remove Insight
        </Button>
      </div>
      <div className="rmdw-cp-next">
        Next: <a onClick={goToActions}>Configure Actions →</a>
      </div>
    </div>
  );
}

function ActionConfig({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const sel = state.selection;
  const groupIdx = sel.groupIdx!;
  const insightIdx = sel.insightIdx!;
  const insight = state.groups[groupIdx].insights[insightIdx];

  const toggle = (field: 'snoozeEnabled' | 'dismissEnabled') =>
    setState((s) => ({
      ...s,
      groups: s.groups.map((g, gi) =>
        gi === groupIdx
          ? {
              ...g,
              insights: g.insights.map((ins, ji) =>
                ji === insightIdx ? { ...ins, [field]: !ins[field] } : ins,
              ),
            }
          : g,
      ),
    }));

  return (
    <div className="rmdw-config-panel">
      <div className="rmdw-snooze-card">
        <h3 className="rmdw-cp-title" style={{ marginBottom: 8 }}>Snooze / Dismiss</h3>
        <div className="rmdw-snooze-row">
          <div>
            <div className="rmdw-snooze-label">Snooze</div>
            <div className="rmdw-snooze-sub">Enable at runtime</div>
          </div>
          <Toggle
            checked={insight.snoozeEnabled}
            onChange={() => toggle('snoozeEnabled')}
            label={insight.snoozeEnabled ? 'Enabled' : 'Disabled'}
          />
        </div>
        <div className="rmdw-snooze-row">
          <div>
            <div className="rmdw-snooze-label">Dismiss</div>
            <div className="rmdw-snooze-sub">Enable at runtime</div>
          </div>
          <Toggle
            checked={insight.dismissEnabled}
            onChange={() => toggle('dismissEnabled')}
            label={insight.dismissEnabled ? 'Enabled' : 'Disabled'}
          />
        </div>
      </div>

      <h3 className="rmdw-cp-title">Configure Actions</h3>
      <p style={{ fontSize: 13, color: 'var(--slds-g-color-on-surface-1)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
        Actions are defined in the Activities and Stages section.
      </p>
      <Button
        variant="neutral"
        onClick={() => { window.location.href = '/activities'; }}
        iconLeading={<Icon name="workflow" size={14} />}
      >
        Go to Activities and Stages
      </Button>
    </div>
  );
}

// Step 3 — Activate
function Step3({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  return (
    <>
      {state.active && (
        <div className="rmdw-act-banner">
          <Icon name="check" size={18} />
          <span>You've successfully activated this Run My Day configuration.</span>
        </div>
      )}
      <h3 className="rmdw-act-title">Activation</h3>
      <p className="rmdw-act-sub">
        After activation, this Run My Day playbook will be available for configuration in Lighting
        App Builder.
      </p>
      <div className="rmdw-act-row">
        <div>
          <div className="rmdw-act-row-label">Activate This Configuration</div>
          <div className="rmdw-act-row-hint">Enable at runtime</div>
        </div>
        <Toggle
          checked={state.active}
          onChange={() => setState((s) => ({ ...s, active: !s.active }))}
          label={state.active ? 'Enabled' : 'Disabled'}
        />
      </div>
    </>
  );
}

