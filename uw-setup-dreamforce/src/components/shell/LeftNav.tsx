import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/ui';
import './LeftNav.css';

interface LeafItem {
  label: string;
  to: string;
}

interface BranchItem {
  label: string;
  children: (LeafItem | BranchItem)[];
}

type NavItem = LeafItem | BranchItem;

function isBranch(it: NavItem): it is BranchItem {
  return (it as BranchItem).children !== undefined;
}

const NAV_TREE: NavItem[] = [
  { label: 'Integrations', to: '/integrations' },
  { label: 'Run My Day', to: '/run-my-day/playbooks' },
  {
    label: 'Underwriting',
    children: [
      { label: 'General Setup', to: '/general-setup' },
      { label: 'Submission Settings', to: '/submission-settings' },
      { label: 'Lines of Business', to: '/lines-of-business' },
    ],
  },
  { label: 'Object Management', to: '/object-management' },
];

function NavBranch({ item, depth }: { item: BranchItem; depth: number }) {
  const [open, setOpen] = useState(true);
  return (
    <li className="slds2-nav__node">
      <button
        type="button"
        className="slds2-nav__row slds2-nav__row--branch"
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon
          name="chevron-right"
          size={12}
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--slds-g-duration-fast)',
          }}
        />
        <span>{item.label}</span>
      </button>
      {open && (
        <ul className="slds2-nav__children">
          {item.children.map((c) =>
            isBranch(c) ? (
              <NavBranch key={c.label} item={c} depth={depth + 1} />
            ) : (
              <NavLeaf key={c.to} item={c} depth={depth + 1} />
            ),
          )}
        </ul>
      )}
    </li>
  );
}

function NavLeaf({ item, depth }: { item: LeafItem; depth: number }) {
  // Match the branch row's text start position so siblings at the same depth
  // are vertically aligned: branch row uses paddingLeft = depth*16 + 12 plus a
  // 12px chevron and an 8px gap before its text (= depth*16 + 32).
  return (
    <li className="slds2-nav__node">
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          `slds2-nav__row slds2-nav__row--leaf${isActive ? ' slds2-nav__row--active' : ''}`
        }
        style={{ paddingLeft: `${depth * 16 + 32}px` }}
      >
        <span>{item.label}</span>
      </NavLink>
    </li>
  );
}

export function LeftNav() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <nav
      className={['slds2-nav', collapsed ? 'slds2-nav--collapsed' : ''].filter(Boolean).join(' ')}
      aria-label="Setup navigation"
    >
      <div className="slds2-nav__header">
        {!collapsed && <span className="slds2-nav__title">Setup</span>}
        <button
          type="button"
          className="slds2-nav__toggle"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setCollapsed((v) => !v)}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="slds2-nav__search">
            <Icon name="search" size={13} />
            <input type="text" placeholder="Quick Find" />
          </div>
          <ul className="slds2-nav__tree">
            {NAV_TREE.map((it) =>
              isBranch(it) ? (
                <NavBranch key={it.label} item={it} depth={0} />
              ) : (
                <NavLeaf key={it.to} item={it} depth={0} />
              ),
            )}
          </ul>
        </>
      )}
    </nav>
  );
}
