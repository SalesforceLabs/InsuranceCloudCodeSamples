import type { ReactNode } from 'react';
import './PageHeader.css';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <header className="slds2-page-header">
      <div className="slds2-page-header__left">
        {icon && <div className="slds2-page-header__icon">{icon}</div>}
        <div>
          {eyebrow && <div className="slds2-page-header__eyebrow">{eyebrow}</div>}
          <h1 className="slds2-page-header__title">{title}</h1>
          {subtitle && <p className="slds2-page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="slds2-page-header__actions">{actions}</div>}
    </header>
  );
}
