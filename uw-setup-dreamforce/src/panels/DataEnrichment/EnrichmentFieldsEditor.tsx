import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Input, Select } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type {
  EnrichmentCategory,
  EnrichmentConfig,
  EnrichmentField,
  EnrichmentFieldType,
} from '@/types/config';
import '@/panels/RunMyDay/PlaybookWizard.css';
import './EnrichmentFieldsEditor.css';

const FIELD_TYPES: EnrichmentFieldType[] = [
  'Text',
  'Number',
  'Currency',
  'Percent',
  'Boolean',
  'Date',
  'Picklist',
  'Long Text Area',
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Navigation focus: drives which Groups / Fields are visible. Always set when
 * there is data, never cleared by closing the editor. Renders tiles with the
 * "focus" style (fill only, no stroke).
 */
interface NavFocus {
  lobIdx: number | null;
  groupIdx: number | null;
}

/**
 * What the right-hand editor panel is showing. When non-null, the targeted
 * tile renders with the "selected" style (fill + accent stroke). Closing the
 * editor sets this to null.
 */
type EditorTarget =
  | { kind: 'lob'; lobIdx: number }
  | { kind: 'group'; lobIdx: number; groupIdx: number }
  | { kind: 'field'; lobIdx: number; groupIdx: number; fieldIdx: number };

function defaultNavFocus(configs: EnrichmentConfig[]): NavFocus {
  if (configs.length === 0) return { lobIdx: null, groupIdx: null };
  const lob = configs[0];
  return { lobIdx: 0, groupIdx: lob.categories.length > 0 ? 0 : null };
}

export function EnrichmentFieldsEditor() {
  const { config, update } = useConfig();
  const [nav, setNav] = useState<NavFocus>(() => defaultNavFocus(config.enrichmentConfigs));
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  // Re-anchor nav focus when configs change beneath us (e.g. seed loads async,
  // or the focused LOB / Group is deleted).
  useEffect(() => {
    setNav((curr) => {
      const lobs = config.enrichmentConfigs;
      if (lobs.length === 0) return { lobIdx: null, groupIdx: null };
      let lobIdx = curr.lobIdx;
      if (lobIdx == null || lobIdx >= lobs.length) lobIdx = 0;
      const lob = lobs[lobIdx];
      let groupIdx = curr.groupIdx;
      if (groupIdx != null && (lob.categories.length === 0 || groupIdx >= lob.categories.length)) {
        groupIdx = lob.categories.length > 0 ? 0 : null;
      }
      if (groupIdx == null && lob.categories.length > 0) groupIdx = 0;
      return { lobIdx, groupIdx };
    });
  }, [config.enrichmentConfigs]);

  // Drop a stale editor target when the underlying entity is removed.
  useEffect(() => {
    if (editor == null) return;
    const lobs = config.enrichmentConfigs;
    const lob = lobs[editor.lobIdx];
    if (!lob) {
      setEditor(null);
      return;
    }
    if (editor.kind === 'group' || editor.kind === 'field') {
      const grp = lob.categories[editor.groupIdx];
      if (!grp) {
        setEditor(null);
        return;
      }
      if (editor.kind === 'field' && !grp.fields[editor.fieldIdx]) {
        setEditor(null);
      }
    }
  }, [config.enrichmentConfigs, editor]);

  const selectedLob = nav.lobIdx != null ? config.enrichmentConfigs[nav.lobIdx] : null;
  const selectedGroup =
    selectedLob != null && nav.groupIdx != null ? selectedLob.categories[nav.groupIdx] : null;

  const onClickLob = (i: number) => {
    const lob = config.enrichmentConfigs[i];
    setNav({ lobIdx: i, groupIdx: lob && lob.categories.length > 0 ? 0 : null });
    setEditor((curr) =>
      curr?.kind === 'lob' && curr.lobIdx === i ? null : { kind: 'lob', lobIdx: i },
    );
  };

  const onClickGroup = (i: number) => {
    if (nav.lobIdx == null) return;
    const lobIdx = nav.lobIdx;
    setNav((s) => ({ ...s, groupIdx: i }));
    setEditor((curr) =>
      curr?.kind === 'group' && curr.lobIdx === lobIdx && curr.groupIdx === i
        ? null
        : { kind: 'group', lobIdx, groupIdx: i },
    );
  };

  const onClickField = (i: number) => {
    if (nav.lobIdx == null || nav.groupIdx == null) return;
    const lobIdx = nav.lobIdx;
    const groupIdx = nav.groupIdx;
    setEditor((curr) =>
      curr?.kind === 'field' &&
      curr.lobIdx === lobIdx &&
      curr.groupIdx === groupIdx &&
      curr.fieldIdx === i
        ? null
        : { kind: 'field', lobIdx, groupIdx, fieldIdx: i },
    );
  };

  const onAddLob = () => {
    const newIdx = config.enrichmentConfigs.length;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: [
        ...prev.enrichmentConfigs,
        {
          id: prev.nextEnrichmentConfigId,
          lob: 'New LOB',
          active: true,
          categories: [],
        },
      ],
      nextEnrichmentConfigId: prev.nextEnrichmentConfigId + 1,
    }));
    setNav({ lobIdx: newIdx, groupIdx: null });
    setEditor({ kind: 'lob', lobIdx: newIdx });
  };

  const onAddGroup = () => {
    if (nav.lobIdx == null) return;
    const lobIdx = nav.lobIdx;
    const newIdx = config.enrichmentConfigs[lobIdx]?.categories.length ?? 0;
    const newGroup: EnrichmentCategory = {
      id: `group-${Date.now()}`,
      name: 'New Group',
      fields: [],
    };
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c, i) =>
        i === lobIdx ? { ...c, categories: [...c.categories, newGroup] } : c,
      ),
    }));
    setNav((s) => ({ ...s, groupIdx: newIdx }));
    setEditor({ kind: 'group', lobIdx, groupIdx: newIdx });
  };

  const onAddField = () => {
    if (nav.lobIdx == null || nav.groupIdx == null) return;
    const lobIdx = nav.lobIdx;
    const groupIdx = nav.groupIdx;
    const newIdx = config.enrichmentConfigs[lobIdx]?.categories[groupIdx]?.fields.length ?? 0;
    const newField: EnrichmentField = { name: 'New Field', type: 'Text' };
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c, ci) =>
        ci !== lobIdx
          ? c
          : {
              ...c,
              categories: c.categories.map((g, gi) =>
                gi !== groupIdx ? g : { ...g, fields: [...g.fields, newField] },
              ),
            },
      ),
    }));
    setEditor({ kind: 'field', lobIdx, groupIdx, fieldIdx: newIdx });
  };

  const updateLob = (patch: Partial<EnrichmentConfig>) => {
    if (editor?.kind !== 'lob') return;
    const i = editor.lobIdx;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c, ci) => (ci === i ? { ...c, ...patch } : c)),
    }));
  };

  const updateGroup = (patch: Partial<EnrichmentCategory>) => {
    if (editor?.kind !== 'group') return;
    const { lobIdx, groupIdx } = editor;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c, ci) =>
        ci !== lobIdx
          ? c
          : {
              ...c,
              categories: c.categories.map((g, gi) => (gi === groupIdx ? { ...g, ...patch } : g)),
            },
      ),
    }));
  };

  const updateField = (patch: Partial<EnrichmentField>) => {
    if (editor?.kind !== 'field') return;
    const { lobIdx, groupIdx, fieldIdx } = editor;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c, ci) =>
        ci !== lobIdx
          ? c
          : {
              ...c,
              categories: c.categories.map((g, gi) =>
                gi !== groupIdx
                  ? g
                  : {
                      ...g,
                      fields: g.fields.map((f, fi) => (fi === fieldIdx ? { ...f, ...patch } : f)),
                    },
              ),
            },
      ),
    }));
  };

  const removeLob = () => {
    if (editor?.kind !== 'lob') return;
    const lob = config.enrichmentConfigs[editor.lobIdx];
    if (!lob) return;
    if (!confirm(`Remove "${lob.lob}" and all its groups and fields?`)) return;
    const i = editor.lobIdx;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.filter((_, ci) => ci !== i),
    }));
    setEditor(null);
  };

  const removeGroup = () => {
    if (editor?.kind !== 'group') return;
    const { lobIdx, groupIdx } = editor;
    const grp = config.enrichmentConfigs[lobIdx]?.categories[groupIdx];
    if (!grp) return;
    if (!confirm(`Remove group "${grp.name}" and all its fields?`)) return;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c, ci) =>
        ci !== lobIdx ? c : { ...c, categories: c.categories.filter((_, gi) => gi !== groupIdx) },
      ),
    }));
    setEditor(null);
  };

  const removeField = () => {
    if (editor?.kind !== 'field') return;
    const { lobIdx, groupIdx, fieldIdx } = editor;
    const f =
      config.enrichmentConfigs[lobIdx]?.categories[groupIdx]?.fields[fieldIdx];
    if (!f) return;
    if (!confirm(`Remove field "${f.name}"?`)) return;
    update((prev) => ({
      ...prev,
      enrichmentConfigs: prev.enrichmentConfigs.map((c, ci) =>
        ci !== lobIdx
          ? c
          : {
              ...c,
              categories: c.categories.map((g, gi) =>
                gi !== groupIdx
                  ? g
                  : { ...g, fields: g.fields.filter((_, fi) => fi !== fieldIdx) },
              ),
            },
      ),
    }));
    setEditor(null);
  };

  return (
    <div className="rmdw-step2" style={{ minHeight: 480 }}>
      <Preview
        config={config.enrichmentConfigs}
        nav={nav}
        editor={editor}
        selectedLob={selectedLob}
        selectedGroup={selectedGroup}
        onClickLob={onClickLob}
        onClickGroup={onClickGroup}
        onClickField={onClickField}
        onAddLob={onAddLob}
        onAddGroup={onAddGroup}
        onAddField={onAddField}
      />
      {editor != null && (
        <ConfigPanel
          config={config.enrichmentConfigs}
          editor={editor}
          onClose={() => setEditor(null)}
          onUpdateLob={updateLob}
          onUpdateGroup={updateGroup}
          onUpdateField={updateField}
          onRemoveLob={removeLob}
          onRemoveGroup={removeGroup}
          onRemoveField={removeField}
          onAddGroup={onAddGroup}
          onAddField={onAddField}
        />
      )}
    </div>
  );
}

interface PreviewProps {
  config: EnrichmentConfig[];
  nav: NavFocus;
  editor: EditorTarget | null;
  selectedLob: EnrichmentConfig | null;
  selectedGroup: EnrichmentCategory | null;
  onClickLob: (i: number) => void;
  onClickGroup: (i: number) => void;
  onClickField: (i: number) => void;
  onAddLob: () => void;
  onAddGroup: () => void;
  onAddField: () => void;
}

function Preview({
  config,
  nav,
  editor,
  selectedLob,
  selectedGroup,
  onClickLob,
  onClickGroup,
  onClickField,
  onAddLob,
  onAddGroup,
  onAddField,
}: PreviewProps) {
  const tileClass = (selected: boolean, focused: boolean) =>
    [
      'rmdw-prev-item',
      selected ? 'rmdw-prev-item--selected' : '',
      // focus only paints when selected isn't — `selected` already includes the fill.
      !selected && focused ? 'rmdw-prev-item--focus' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="rmdw-preview">
      <div className="rmdw-prev-col">
        <ColumnHeader title="Line of Business" onAdd={onAddLob} />
        {config.map((c, i) => {
          const selected = editor?.kind === 'lob' && editor.lobIdx === i;
          const focused = nav.lobIdx === i;
          return (
            <div
              key={c.id}
              className={tileClass(selected, focused)}
              onClick={() => onClickLob(i)}
            >
              <span style={{ flex: 1, fontWeight: 500 }}>{c.lob || `LOB ${i + 1}`}</span>
              <span style={{ fontSize: 11, color: 'var(--slds-g-color-on-surface-1)' }}>
                {c.categories.length}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rmdw-prev-col">
        <ColumnHeader
          title="Group"
          onAdd={onAddGroup}
          addDisabled={!selectedLob}
          addTitle={selectedLob ? undefined : 'Select a Line of Business first'}
        />
        {selectedLob ? (
          selectedLob.categories.map((g, i) => {
            const selected =
              editor?.kind === 'group' &&
              editor.lobIdx === nav.lobIdx &&
              editor.groupIdx === i;
            const focused = nav.groupIdx === i;
            return (
              <div
                key={g.id}
                className={tileClass(selected, focused)}
                onClick={() => onClickGroup(i)}
              >
                <span style={{ flex: 1, fontWeight: 500 }}>{g.name || `Group ${i + 1}`}</span>
                <span style={{ fontSize: 11, color: 'var(--slds-g-color-on-surface-1)' }}>
                  {g.fields.length}
                </span>
              </div>
            );
          })
        ) : (
          <div className="rmdw-prev-empty">Select a Line of Business</div>
        )}
      </div>

      <div className="rmdw-prev-col">
        <ColumnHeader
          title="Fields"
          onAdd={onAddField}
          addDisabled={!selectedGroup}
          addTitle={selectedGroup ? undefined : 'Select a Group first'}
        />
        {selectedGroup ? (
          selectedGroup.fields.map((f, i) => {
            // Fields don't have a focus state — only the editor target gets a tint.
            const selected =
              editor?.kind === 'field' &&
              editor.lobIdx === nav.lobIdx &&
              editor.groupIdx === nav.groupIdx &&
              editor.fieldIdx === i;
            return (
              <div
                key={`${selectedGroup.id}-${i}-${f.name}`}
                className={tileClass(selected, false)}
                onClick={() => onClickField(i)}
              >
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name || `Field ${i + 1}`}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--slds-g-color-on-surface-1)',
                    fontWeight: 500,
                  }}
                >
                  {f.type}
                </span>
              </div>
            );
          })
        ) : (
          <div className="rmdw-prev-empty">Select a Group</div>
        )}
      </div>
    </div>
  );
}

/**
 * Column heading row: title on the left, "Add" button on the right. The
 * Add button is the dedicated entry point for that column's create flow.
 * Disable it when the column has no parent context (e.g. Group requires a
 * focused LOB; Fields requires a focused Group).
 */
function ColumnHeader({
  title,
  onAdd,
  addDisabled,
  addTitle,
}: {
  title: string;
  onAdd: () => void;
  addDisabled?: boolean;
  addTitle?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
      }}
    >
      <h4 className="rmdw-prev-col-title" style={{ margin: 0, flex: 1 }}>
        {title}
      </h4>
      <button
        type="button"
        className="ef-col-add"
        onClick={onAdd}
        disabled={addDisabled}
        title={addTitle}
      >
        + Add
      </button>
    </div>
  );
}

interface ConfigPanelProps {
  config: EnrichmentConfig[];
  editor: EditorTarget;
  onClose: () => void;
  onUpdateLob: (patch: Partial<EnrichmentConfig>) => void;
  onUpdateGroup: (patch: Partial<EnrichmentCategory>) => void;
  onUpdateField: (patch: Partial<EnrichmentField>) => void;
  onRemoveLob: () => void;
  onRemoveGroup: () => void;
  onRemoveField: () => void;
  onAddGroup: () => void;
  onAddField: () => void;
}

function ConfigPanel(props: ConfigPanelProps) {
  const { editor } = props;
  if (editor.kind === 'lob') return <LobConfig {...props} />;
  if (editor.kind === 'group') return <GroupConfig {...props} />;
  return <FieldConfig {...props} />;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="rmdw-cp-close"
      onClick={onClose}
      aria-label="Close editor"
      title="Close editor"
    >
      <Icon name="close" size={16} />
    </button>
  );
}

function LobConfig({
  config,
  editor,
  onClose,
  onUpdateLob,
  onRemoveLob,
  onAddGroup,
}: ConfigPanelProps) {
  if (editor.kind !== 'lob') return null;
  const lob = config[editor.lobIdx];
  if (!lob) return null;
  return (
    <div className="rmdw-config-panel" style={{ position: 'relative' }}>
      <CloseButton onClose={onClose} />
      <h3 className="rmdw-cp-title">Configure Line of Business</h3>
      <Input
        label="LOB Name"
        value={lob.lob}
        onChange={(e) => onUpdateLob({ lob: e.target.value })}
        fullWidth
      />
      <div style={{ height: 12 }} />
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--slds-g-color-on-surface-2)',
          fontWeight: 600,
        }}
      >
        <input
          type="checkbox"
          checked={lob.active}
          onChange={(e) => onUpdateLob({ active: e.target.checked })}
        />
        Active
      </label>
      <div style={{ height: 16 }} />
      <Button variant="destructive" onClick={onRemoveLob} fullWidth iconLeading={<Icon name="trash" size={14} />}>
        Remove LOB
      </Button>
      <div className="rmdw-cp-next">
        Next: <a onClick={onAddGroup}>Add a Group →</a>
      </div>
    </div>
  );
}

function GroupConfig({
  config,
  editor,
  onClose,
  onUpdateGroup,
  onRemoveGroup,
  onAddField,
}: ConfigPanelProps) {
  if (editor.kind !== 'group') return null;
  const group = config[editor.lobIdx]?.categories[editor.groupIdx];
  if (!group) return null;
  return (
    <div className="rmdw-config-panel" style={{ position: 'relative' }}>
      <CloseButton onClose={onClose} />
      <h3 className="rmdw-cp-title">Configure Group</h3>
      <Input
        label="Group Name"
        value={group.name}
        onChange={(e) => onUpdateGroup({ name: e.target.value })}
        fullWidth
      />
      <div style={{ height: 12 }} />
      <Input
        label="API Name"
        value={group.id}
        onChange={(e) => onUpdateGroup({ id: e.target.value })}
        hint="Stable identifier referenced by enrichment definitions."
        fullWidth
      />
      <div style={{ marginTop: 8 }}>
        <Button
          variant="link"
          onClick={() => onUpdateGroup({ id: slugify(group.name) || group.id })}
        >
          Generate API name from group name
        </Button>
      </div>
      <div style={{ height: 16 }} />
      <Button variant="destructive" onClick={onRemoveGroup} fullWidth iconLeading={<Icon name="trash" size={14} />}>
        Remove Group
      </Button>
      <div className="rmdw-cp-next">
        Next: <a onClick={onAddField}>Add a Field →</a>
      </div>
    </div>
  );
}

function FieldConfig({
  config,
  editor,
  onClose,
  onUpdateField,
  onRemoveField,
}: ConfigPanelProps) {
  if (editor.kind !== 'field') return null;
  const field =
    config[editor.lobIdx]?.categories[editor.groupIdx]?.fields[editor.fieldIdx];
  if (!field) return null;
  const typeOptions = useMemo(
    () => FIELD_TYPES.map((t) => ({ value: t, label: t })),
    [],
  );
  return (
    <div className="rmdw-config-panel" style={{ position: 'relative' }}>
      <CloseButton onClose={onClose} />
      <h3 className="rmdw-cp-title">Configure Field</h3>
      <Input
        label="Field Name"
        value={field.name}
        onChange={(e) => onUpdateField({ name: e.target.value })}
        fullWidth
      />
      <div style={{ height: 12 }} />
      <Select
        label="Data Type"
        value={field.type}
        onChange={(e) => onUpdateField({ type: e.target.value as EnrichmentFieldType })}
        options={typeOptions}
      />
      <div style={{ height: 16 }} />
      <Button variant="destructive" onClick={onRemoveField} fullWidth iconLeading={<Icon name="trash" size={14} />}>
        Remove Field
      </Button>
    </div>
  );
}
