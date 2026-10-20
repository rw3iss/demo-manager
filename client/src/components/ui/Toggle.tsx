import styles from './Toggle.module.scss';
import { cx } from '@/lib/cx';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <label class={cx(styles.wrap, disabled && styles.disabled)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        class={cx(styles.track, checked && styles.on)}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span class={styles.thumb} />
      </button>
      {label && <span class={styles.label}>{label}</span>}
    </label>
  );
}
