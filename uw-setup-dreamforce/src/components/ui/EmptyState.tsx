import type { ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="slds2-empty">
      {icon && <div className="slds2-empty__icon">{icon}</div>}
      <h3 className="slds2-empty__title">{title}</h3>
      {description && <p className="slds2-empty__desc">{description}</p>}
      {action && <div className="slds2-empty__action">{action}</div>}
    </div>
  );
}
