import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

type Variant = 'brand' | 'neutral' | 'destructive' | 'success' | 'link' | 'icon';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'neutral',
  size = 'md',
  iconLeading,
  iconTrailing,
  fullWidth,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'slds2-btn',
    `slds2-btn--${variant}`,
    `slds2-btn--${size}`,
    fullWidth ? 'slds2-btn--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {iconLeading && <span className="slds2-btn__icon slds2-btn__icon--leading">{iconLeading}</span>}
      {children != null && <span className="slds2-btn__label">{children}</span>}
      {iconTrailing && <span className="slds2-btn__icon slds2-btn__icon--trailing">{iconTrailing}</span>}
    </button>
  );
}
