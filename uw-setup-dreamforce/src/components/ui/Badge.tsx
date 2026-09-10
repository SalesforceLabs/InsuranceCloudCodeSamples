import type { ReactNode } from 'react';
import './Badge.css';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  outline?: boolean;
}

export function Badge({ tone = 'neutral', outline, children }: BadgeProps) {
  return <span className={`slds2-badge slds2-badge--${tone}${outline ? ' slds2-badge--outline' : ''}`}>{children}</span>;
}
