import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import styles from './Modal.module.scss';
import { cx } from '@/lib/cx';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: 'sm' | 'md';
}

export function Modal({ open, title, onClose, children, footer, size = 'md' }: Props) {
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

  return (
    <div class={styles.overlay} onClick={onClose}>
      <div class={cx(styles.panel, styles[size])} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header class={styles.head}>
          <h2 class={styles.title}>{title}</h2>
          <button class={styles.close} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div class={styles.body}>{children}</div>
        {footer && <footer class={styles.foot}>{footer}</footer>}
      </div>
    </div>
  );
}
