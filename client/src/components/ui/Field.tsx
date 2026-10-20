import type { JSX } from 'preact';
import styles from './Field.module.scss';
import { cx } from '@/lib/cx';

interface BaseProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function Field({
  label,
  hint,
  error,
  class: cls,
  ...rest
}: BaseProps & JSX.IntrinsicElements['input']) {
  return (
    <label class={styles.field}>
      {label && <span class={styles.label}>{label}</span>}
      <input class={cx(styles.input, error && styles.invalid, cls as string)} {...rest} />
      {error ? <span class={styles.error}>{error}</span> : hint ? <span class={styles.hint}>{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  error,
  class: cls,
  ...rest
}: BaseProps & JSX.IntrinsicElements['textarea']) {
  return (
    <label class={styles.field}>
      {label && <span class={styles.label}>{label}</span>}
      <textarea class={cx(styles.input, styles.textarea, error && styles.invalid, cls as string)} {...rest} />
      {error ? <span class={styles.error}>{error}</span> : hint ? <span class={styles.hint}>{hint}</span> : null}
    </label>
  );
}
