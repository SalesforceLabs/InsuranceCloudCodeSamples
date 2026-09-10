import { forwardRef, type SelectHTMLAttributes } from 'react';
import './Input.css';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, fullWidth, options, children, className, id, ...rest },
  ref,
) {
  const sId = id ?? `slds2-sel-${Math.random().toString(36).slice(2, 9)}`;
  const wrapClass = ['slds2-field', fullWidth ? 'slds2-field--full' : ''].filter(Boolean).join(' ');
  return (
    <div className={wrapClass}>
      {label && (
        <label htmlFor={sId} className="slds2-field__label">
          {label}
          {required && <span className="slds2-field__required"> *</span>}
        </label>
      )}
      <div className="slds2-select__wrap">
        <select
          ref={ref}
          id={sId}
          className={['slds2-select', error ? 'slds2-input--error' : '', className ?? '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={!!error}
          required={required}
          {...rest}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <svg
          className="slds2-select__chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {error ? (
        <p className="slds2-field__msg slds2-field__msg--error">{error}</p>
      ) : hint ? (
        <p className="slds2-field__msg">{hint}</p>
      ) : null}
    </div>
  );
});
