import type { ReactNode } from 'react';
import './Card.css';

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function Card({ title, subtitle, actions, footer, children, padding = 'md', className }: CardProps) {
  return (
    <section className={['slds2-card', className ?? ''].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <header className="slds2-card__header">
          <div className="slds2-card__titles">
            {title && <h2 className="slds2-card__title">{title}</h2>}
            {subtitle && <p className="slds2-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="slds2-card__actions">{actions}</div>}
        </header>
      )}
      <div className={`slds2-card__body slds2-card__body--${padding}`}>{children}</div>
      {footer && <footer className="slds2-card__footer">{footer}</footer>}
    </section>
  );
}
