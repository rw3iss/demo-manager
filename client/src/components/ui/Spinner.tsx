import styles from './Spinner.module.scss';

export function Spinner({ label }: { label?: string }) {
  return (
    <div class={styles.wrap}>
      <span class={styles.ring} aria-hidden />
      {label && <span class={styles.label}>{label}</span>}
    </div>
  );
}
