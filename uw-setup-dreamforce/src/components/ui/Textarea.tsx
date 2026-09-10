import { forwardRef, type TextareaHTMLAttributes } from 'react';
import './Input.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, fullWidth, className, id, ...rest },
  ref,
) {
  const taId = id ?? `slds2-ta-${Math.random().toString(36).slice(2, 9)}`;
  const wrapClass = ['slds2-field', fullWidth ? 'slds2-field--full' : ''].filter(Boolean).join(' ');
  return (
    <div className={wrapClass}>
      {label && (
        <label htmlFor={taId} className="slds2-field__label">
          {label}
          {required && <span className="slds2-field__required"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={taId}
        className={['slds2-textarea', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={!!error}
        required={required}
        {...rest}
      />
      {error ? (
        <p className="slds2-field__msg slds2-field__msg--error">{error}</p>
      ) : hint ? (
        <p className="slds2-field__msg">{hint}</p>
      ) : null}
    </div>
  );
});
