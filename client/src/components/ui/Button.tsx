import type { JSX } from 'preact';
import styles from './Button.module.scss';
import { cx } from '@/lib/cx';

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md';

interface Props extends Omit<JSX.IntrinsicElements['button'], 'size'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant = 'subtle', size = 'md', loading, class: cls, children, disabled, ...rest }: Props) {
  return (
    <button
      class={cx(styles.btn, styles[variant], styles[size], loading && styles.loading, cls as string)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span class={styles.spinner} aria-hidden />}
      <span class={styles.label}>{children}</span>
    </button>
  );
}
