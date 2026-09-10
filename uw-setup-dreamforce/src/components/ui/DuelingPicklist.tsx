import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import './DuelingPicklist.css';

export interface DuelingPicklistOption {
  value: string;
  label: string;
}

export interface DuelingPicklistProps {
  /** All options the user can pick from. */
  options: DuelingPicklistOption[];
  /** Values currently in the right column. */
  selected: string[];
  onChange: (next: string[]) => void;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

/**
 * SLDS-style dueling picklist. Two side-by-side scrollable lists with
 * Add (right arrow) and Remove (left arrow) buttons in the middle. The
 * selected list preserves the order in which items were added; ↑ / ↓
 * reorder them.
 */
export function DuelingPicklist({
  options,
  selected,
  onChange,
  leftLabel = 'Available',
  rightLabel = 'Selected',
  className,
}: DuelingPicklistProps) {
  const [leftHi, setLeftHi] = useState<Set<string>>(new Set());
  const [rightHi, setRightHi] = useState<Set<string>>(new Set());

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const available = useMemo(
    () => options.filter((o) => !selectedSet.has(o.value)),
    [options, selectedSet],
  );
  const selectedOptions = useMemo(
    () =>
      selected
        .map((v) => options.find((o) => o.value === v))
        .filter((o): o is DuelingPicklistOption => !!o),
    [selected, options],
  );

  const toggleLeft = (v: string) =>
    setLeftHi((curr) => {
      const next = new Set(curr);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  const toggleRight = (v: string) =>
    setRightHi((curr) => {
      const next = new Set(curr);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const onAdd = () => {
    if (leftHi.size === 0) return;
    const adds = available
      .map((o) => o.value)
      .filter((v) => leftHi.has(v));
    onChange([...selected, ...adds]);
    setLeftHi(new Set());
  };
  const onRemove = () => {
    if (rightHi.size === 0) return;
    onChange(selected.filter((v) => !rightHi.has(v)));
    setRightHi(new Set());
  };
  const onUp = () => {
    if (rightHi.size === 0) return;
    const next = selected.slice();
    for (let i = 1; i < next.length; i++) {
      if (rightHi.has(next[i]) && !rightHi.has(next[i - 1])) {
        [next[i - 1], next[i]] = [next[i], next[i - 1]];
      }
    }
    onChange(next);
  };
  const onDown = () => {
    if (rightHi.size === 0) return;
    const next = selected.slice();
    for (let i = next.length - 2; i >= 0; i--) {
      if (rightHi.has(next[i]) && !rightHi.has(next[i + 1])) {
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
    }
    onChange(next);
  };

  return (
    <div className={['slds2-dueling', className ?? ''].filter(Boolean).join(' ')}>
      <div className="slds2-dueling__col">
        <div className="slds2-dueling__label">{leftLabel}</div>
        <ul
          className="slds2-dueling__list"
          role="listbox"
          aria-multiselectable="true"
          aria-label={leftLabel}
        >
          {available.length === 0 ? (
            <li className="slds2-dueling__empty">No items available.</li>
          ) : (
            available.map((o) => (
              <li
                key={o.value}
                className={[
                  'slds2-dueling__item',
                  leftHi.has(o.value) ? 'slds2-dueling__item--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="option"
                aria-selected={leftHi.has(o.value)}
                tabIndex={0}
                onClick={() => toggleLeft(o.value)}
                onDoubleClick={() => onChange([...selected, o.value])}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleLeft(o.value);
                  }
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="slds2-dueling__actions">
        <button
          type="button"
          className="slds2-dueling__btn"
          onClick={onAdd}
          disabled={leftHi.size === 0}
          aria-label="Move right"
          title="Move right"
        >
          <Icon name="chevron-right" size={14} />
        </button>
        <button
          type="button"
          className="slds2-dueling__btn"
          onClick={onRemove}
          disabled={rightHi.size === 0}
          aria-label="Move left"
          title="Move left"
        >
          <Icon name="chevron-left" size={14} />
        </button>
      </div>

      <div className="slds2-dueling__col">
        <div className="slds2-dueling__label">{rightLabel}</div>
        <ul
          className="slds2-dueling__list"
          role="listbox"
          aria-multiselectable="true"
          aria-label={rightLabel}
        >
          {selectedOptions.length === 0 ? (
            <li className="slds2-dueling__empty">Nothing selected yet.</li>
          ) : (
            selectedOptions.map((o) => (
              <li
                key={o.value}
                className={[
                  'slds2-dueling__item',
                  rightHi.has(o.value) ? 'slds2-dueling__item--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="option"
                aria-selected={rightHi.has(o.value)}
                tabIndex={0}
                onClick={() => toggleRight(o.value)}
                onDoubleClick={() => onChange(selected.filter((v) => v !== o.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleRight(o.value);
                  }
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="slds2-dueling__actions">
        <button
          type="button"
          className="slds2-dueling__btn"
          onClick={onUp}
          disabled={rightHi.size === 0}
          aria-label="Move up"
          title="Move up"
        >
          <Icon name="chevron-down" size={14} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button
          type="button"
          className="slds2-dueling__btn"
          onClick={onDown}
          disabled={rightHi.size === 0}
          aria-label="Move down"
          title="Move down"
        >
          <Icon name="chevron-down" size={14} />
        </button>
      </div>
    </div>
  );
}
