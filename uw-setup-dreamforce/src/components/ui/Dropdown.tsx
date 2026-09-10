import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import './Dropdown.css';

/**
 * Standard custom dropdown. Replaces the native `<select>` everywhere a
 * consistent, portal-rendered menu is wanted (the browser's default option list
 * can't be styled and looks foreign against the app). The trigger mirrors the
 * SLDS 2 Select sizing/colors; the menu is portalled to `document.body` so it
 * escapes modal/overflow clipping.
 *
 * Component styling hooks (this component isn't in the SLDS 2 package, so its
 * contract is documented here): consumes globals only — surface, border,
 * accent, radius, shadow, typography via `--slds-g-*`.
 */

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional secondary line shown beneath the label (both in the menu and,
   * when selected, kept out of the trigger — the trigger shows the label only). */
  description?: string;
  disabled?: boolean;
}

export interface DropdownOptionGroup {
  label: string;
  options: DropdownOption[];
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  /** Flat options. Mutually exclusive with `groups`. */
  options?: DropdownOption[];
  /** Grouped options (rendered with an optgroup-style header). */
  groups?: DropdownOptionGroup[];
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  'aria-label'?: string;
  className?: string;
}

function flatten(options?: DropdownOption[], groups?: DropdownOptionGroup[]): DropdownOption[] {
  if (groups) return groups.flatMap((g) => g.options);
  return options ?? [];
}

export function Dropdown({
  value,
  onChange,
  options,
  groups,
  placeholder = 'Select…',
  disabled,
  fullWidth = true,
  className,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const all = useMemo(() => flatten(options, groups), [options, groups]);
  const selected = all.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const place = () => {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const inTrigger = rootRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const renderOption = (o: DropdownOption) => {
    const isSel = o.value === value;
    return (
      <div
        key={o.value}
        role="option"
        aria-selected={isSel}
        aria-disabled={o.disabled || undefined}
        className={[
          'slds2-dropdown__option',
          isSel ? 'slds2-dropdown__option--selected' : '',
          o.disabled ? 'slds2-dropdown__option--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          if (o.disabled) return;
          pick(o.value);
        }}
      >
        <span className="slds2-dropdown__option-body">
          <span className="slds2-dropdown__option-label">{o.label}</span>
          {o.description && (
            <span className="slds2-dropdown__option-desc">{o.description}</span>
          )}
        </span>
        {isSel && <Icon name="check" size={12} />}
      </div>
    );
  };

  return (
    <div
      className={['slds2-dropdown', fullWidth ? 'slds2-dropdown--full' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      ref={rootRef}
    >
      <button
        type="button"
        className="slds2-dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={
            selected ? 'slds2-dropdown__value' : 'slds2-dropdown__placeholder'
          }
        >
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className="slds2-dropdown__chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            className="slds2-dropdown__menu"
            role="listbox"
            ref={menuRef}
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          >
            {groups
              ? groups.map((g) => (
                  <div key={g.label} className="slds2-dropdown__group">
                    {g.label && <div className="slds2-dropdown__group-label">{g.label}</div>}
                    {g.options.map(renderOption)}
                  </div>
                ))
              : all.map(renderOption)}
          </div>,
          document.body,
        )}
    </div>
  );
}
