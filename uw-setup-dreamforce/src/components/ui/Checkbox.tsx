import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import './Checkbox.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  hint?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className, id, ...rest },
  ref,
) {
  const cbId = id ?? `slds2-cb-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <label className={['slds2-checkbox', className ?? ''].filter(Boolean).join(' ')} htmlFor={cbId}>
      <input ref={ref} id={cbId} type="checkbox" className="slds2-checkbox__input" {...rest} />
      <span className="slds2-checkbox__box" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label != null && (
        <span className="slds2-checkbox__label">
          {label}
          {hint && <span className="slds2-checkbox__hint">{hint}</span>}
        </span>
      )}
    </label>
  );
});
