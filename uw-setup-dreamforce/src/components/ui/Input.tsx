import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, iconLeading, iconTrailing, fullWidth, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `slds2-input-${Math.random().toString(36).slice(2, 9)}`;
  const wrapClass = ['slds2-field', fullWidth ? 'slds2-field--full' : ''].filter(Boolean).join(' ');
  const inputClass = [
    'slds2-input',
    error ? 'slds2-input--error' : '',
    iconLeading ? 'slds2-input--icon-leading' : '',
    iconTrailing ? 'slds2-input--icon-trailing' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      {label && (
        <label htmlFor={inputId} className="slds2-field__label">
          {label}
          {required && <span className="slds2-field__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="slds2-input__wrap">
        {iconLeading && <span className="slds2-input__icon slds2-input__icon--leading">{iconLeading}</span>}
        <input ref={ref} id={inputId} className={inputClass} aria-invalid={!!error} required={required} {...rest} />
        {iconTrailing && <span className="slds2-input__icon slds2-input__icon--trailing">{iconTrailing}</span>}
      </div>
      {error ? (
        <p className="slds2-field__msg slds2-field__msg--error">{error}</p>
      ) : hint ? (
        <p className="slds2-field__msg">{hint}</p>
      ) : null}
    </div>
  );
});
