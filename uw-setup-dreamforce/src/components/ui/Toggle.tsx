import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import './Toggle.css';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  hint?: string;
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(function Toggle(
  { label, hint, className, id, ...rest },
  ref,
) {
  const tId = id ?? `slds2-tg-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <label className={['slds2-toggle', className ?? ''].filter(Boolean).join(' ')} htmlFor={tId}>
      <input ref={ref} id={tId} type="checkbox" className="slds2-toggle__input" {...rest} />
      <span className="slds2-toggle__track" aria-hidden="true">
        <span className="slds2-toggle__thumb" />
      </span>
      {label != null && (
        <span className="slds2-toggle__label">
          {label}
          {hint && <span className="slds2-toggle__hint">{hint}</span>}
        </span>
      )}
    </label>
  );
});
