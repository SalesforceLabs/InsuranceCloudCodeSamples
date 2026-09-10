import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

type Size = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: Size;
  footer?: ReactNode;
  children?: ReactNode;
  closeOnOverlay?: boolean;
  className?: string;
}

export function Modal({ open, onClose, title, size = 'md', footer, children, closeOnOverlay = true, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="slds2-modal__overlay"
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={['slds2-modal', `slds2-modal--${size}`, className ?? ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="slds2-modal__header">
            <h2 className="slds2-modal__title">{title}</h2>
            <button type="button" className="slds2-modal__close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="slds2-modal__body">{children}</div>
        {footer && <div className="slds2-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
