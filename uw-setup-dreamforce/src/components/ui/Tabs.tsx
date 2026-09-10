import type { ReactNode } from 'react';
import './Tabs.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'segment';
}

export function Tabs({ items, active, onChange, variant = 'underline' }: TabsProps) {
  return (
    <div className={`slds2-tabs slds2-tabs--${variant}`} role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={it.id === active}
          disabled={it.disabled}
          className={`slds2-tab${it.id === active ? ' slds2-tab--active' : ''}`}
          onClick={() => onChange(it.id)}
          type="button"
        >
          <span>{it.label}</span>
          {it.badge != null && <span className="slds2-tab__badge">{it.badge}</span>}
        </button>
      ))}
    </div>
  );
}
