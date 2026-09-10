import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Checkbox, Icon, Input, Modal } from '@/components/ui';
import { useConfig } from '@/data/ConfigContext';
import type { StageConfig } from '@/types/config';
import {
  CloneStageConfigModal,
  cloneStageConfig,
  type StageDraft,
} from '@/panels/GeneralSetup/SubmissionStageManagementSection';
import '@/panels/RunMyDay/PlaybookWizard.css';
import '@/panels/ActivitiesAndStages/ActivitiesEntityEditor.css';
import './LobActivitiesSection.css';
import './LobStageManagementSection.css';

interface Props {
  lob: string;
}

function lobKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Build the back-target the detail page should respect. Encodes both the
 * LOB and the section so that returning from the detail page lands on
 * Lines of Business → {lob} → Stage Management instead of the bare hub
 * landing or a different section. */
function backTo(lob: string): string {
  const params = new URLSearchParams({
    lob: lobKey(lob),
    section: `${lobKey(lob)}-stage-management`,
  });
  return `/lines-of-business?${params.toString()}`;
}

/**
 * LOB-scoped Stage Management list. Reads `config.stageConfigs` filtered by
 * `recordType === lob`, mirroring LobActivitiesSection's compact-tile shape.
 *
 * New configurations only ask for Name, Active, Effective From, Effective To
 * — the LOB is implicitly the current LOB and is written to `recordType`.
 *
 * Clicking a tile routes to the existing /activities/lob/:id detail page
 * (ScDetailPanel) with `?from=/lines-of-business` so the back arrow returns
 * to the LOB hub instead of the legacy Activities and Stages page.
 */
export function LobStageManagementSection({ lob }: Props) {
  const { config, update } = useConfig();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<StageConfig | null>(null);

  const configs = useMemo(
    () => config.stageConfigs.filter((c) => c.recordType === lob),
    [config.stageConfigs, lob],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = trimmed
    ? configs.filter((c) => c.name.toLowerCase().includes(trimmed))
    : configs;

  const taskCountFor = (cfg: StageConfig): number => {
    let n = 0;
    cfg.stages.forEach((_stage, idx) => {
      const key = `${cfg.id}:${idx}`;
      n += (config.activitiesData[key] ?? []).length;
    });
    return n;
  };

  const onDelete = (cfg: StageConfig) => {
    if (!confirm(`Delete stage configuration "${cfg.name}"?`)) return;
    update((p) => ({
      ...p,
      stageConfigs: p.stageConfigs.filter((c) => c.id !== cfg.id),
    }));
    setOpenMenuId(null);
  };

  const onCloneSave = (draft: StageDraft) => {
    if (!cloneTarget) return;
    const out = { id: 0 };
    update((p) => cloneStageConfig(p, cloneTarget.id, draft, out));
    setCloneTarget(null);
  };

  const createConfig = (draft: {
    name: string;
    active: boolean;
    effectiveFrom: string;
    effectiveTo: string;
  }): number => {
    let newId = 0;
    update((p) => {
      newId = p.nextStageConfigId;
      const next: StageConfig = {
        id: newId,
        name: draft.name.trim(),
        object: 'Submission',
        recordType: lob,
        picklist: 'Stages',
        stages: [],
        active: draft.active,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo,
      };
      return {
        ...p,
        stageConfigs: [...p.stageConfigs, next],
        nextStageConfigId: p.nextStageConfigId + 1,
      };
    });
    return newId;
  };

  return (
    <div className="lob-activities">
      <header className="lob-activities__header">
        <div>
          <h3 className="lob-activities__title">{lob} — Stage Management</h3>
          <p className="lob-activities__sub">
            {configs.length} configuration{configs.length === 1 ? '' : 's'} scoped to {lob}.
          </p>
        </div>
      </header>

      <div className="lob-activities__toolbar">
        <Input
          placeholder="Search by name"
          iconLeading={<Icon name="search" size={14} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${lob} stage configurations by name`}
          className="lob-activities__search"
        />
        <button
          type="button"
          className="lob-activities__new-btn"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          <Icon name="plus" size={14} />
          New Stage Configuration
        </button>
      </div>

      <NewStageConfigForm
        lob={lob}
        open={creating}
        onCancel={() => setCreating(false)}
        onSave={(draft) => {
          createConfig(draft);
          setCreating(false);
        }}
        onSaveAndConfigure={(draft) => {
          const id = createConfig(draft);
          setCreating(false);
          if (id > 0)
            navigate(
              `/lines-of-business/stage-config/${id}?from=${encodeURIComponent(backTo(lob))}`,
            );
        }}
      />

      <div className="lob-activities__list">
        {configs.length === 0 && !creating ? (
          <div className="lob-activities__empty">
            <p style={{ margin: 0 }}>No stage configurations for {lob} yet.</p>
            <Button
              variant="brand"
              iconLeading={<Icon name="plus" size={14} />}
              onClick={() => setCreating(true)}
            >
              New Stage Configuration
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="lob-activities__empty">No configurations match "{query}".</div>
        ) : (
          visible.map((c) => (
            <StageConfigTile
              key={c.id}
              cfg={c}
              taskCount={taskCountFor(c)}
              onOpen={() =>
                navigate(`/lines-of-business/stage-config/${c.id}?from=${encodeURIComponent(backTo(lob))}`)
              }
              menuOpen={openMenuId === c.id}
              onMenuToggle={(next) =>
                setOpenMenuId(next ? c.id : openMenuId === c.id ? null : openMenuId)
              }
              onEdit={() => {
                setOpenMenuId(null);
                navigate(`/lines-of-business/stage-config/${c.id}?from=${encodeURIComponent(backTo(lob))}`);
              }}
              onClone={() => {
                setOpenMenuId(null);
                setCloneTarget(c);
              }}
              onDelete={() => onDelete(c)}
            />
          ))
        )}
      </div>

      <CloneStageConfigModal
        source={cloneTarget}
        onCancel={() => setCloneTarget(null)}
        onSave={onCloneSave}
      />
    </div>
  );
}

interface TileProps {
  cfg: StageConfig;
  taskCount: number;
  onOpen: () => void;
  menuOpen: boolean;
  onMenuToggle: (next: boolean) => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

function StageConfigTile({
  cfg,
  taskCount,
  onOpen,
  menuOpen,
  onMenuToggle,
  onEdit,
  onClone,
  onDelete,
}: TileProps) {
  const stageCount = cfg.stages.length;
  return (
    <div
      className="act-tile act-tile--compact lob-stage-tile"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="act-tile__actions">
        <div className="lob-stage-tile__actions">
          {cfg.active ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge>Inactive</Badge>
          )}
          <TileMenu
            open={menuOpen}
            onToggle={onMenuToggle}
            onEdit={onEdit}
            onClone={onClone}
            onDelete={onDelete}
          />
        </div>
      </div>
      <div className="act-tile__name">
        <span className="act-tile__name-text">{cfg.name || 'Untitled configuration'}</span>
      </div>
      <div className="lob-stage-tile__sub">
        {stageCount} Stage{stageCount === 1 ? '' : 's'} · {taskCount} Task
        {taskCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

interface TileMenuProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

function TileMenu({ open, onToggle, onEdit, onClone, onDelete }: TileMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        onToggle(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onToggle(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle]);

  return (
    <div className="lob-tile-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="lob-tile-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Stage configuration actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}
      >
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="lob-tile-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item"
            onClick={onEdit}
          >
            <Icon name="edit" size={14} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item"
            onClick={onClone}
          >
            <Icon name="layers" size={14} />
            Clone
          </button>
          <button
            type="button"
            role="menuitem"
            className="lob-tile-menu__item lob-tile-menu__item--destructive"
            onClick={onDelete}
          >
            <Icon name="trash" size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface NewFormProps {
  lob: string;
  open: boolean;
  onCancel: () => void;
  onSave: (draft: StageDraft) => void;
  onSaveAndConfigure: (draft: StageDraft) => void;
}

function NewStageConfigForm({
  lob,
  open,
  onCancel,
  onSave,
  onSaveAndConfigure,
}: NewFormProps) {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState('');

  // Reset the draft each time the modal opens so a cancelled create doesn't
  // leak into the next one.
  useEffect(() => {
    if (!open) return;
    setName('');
    setActive(true);
    setFrom(new Date().toISOString().slice(0, 10));
    setTo('');
  }, [open]);

  const valid = name.trim().length > 0;
  const draft: StageDraft = {
    name: name.trim(),
    active,
    effectiveFrom: from,
    effectiveTo: to,
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="New Stage Configuration"
      footer={
        <>
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="neutral" disabled={!valid} onClick={() => onSave(draft)}>
            Save
          </Button>
          <Button
            variant="brand"
            disabled={!valid}
            onClick={() => onSaveAndConfigure(draft)}
          >
            Save and Configure
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--slds-g-font-scale-neg-1)',
            color: 'var(--slds-g-color-on-surface-1)',
          }}
        >
          Line of Business set to <strong>{lob}</strong> automatically.
        </p>
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g. ${lob} V1`}
          fullWidth
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Effective From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="Effective To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Checkbox
          label="Active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
