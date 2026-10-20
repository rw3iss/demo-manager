import type { ComponentChildren } from 'preact';
import styles from './Badge.module.scss';
import { cx } from '@/lib/cx';

type Tone = 'primary' | 'muted' | 'success' | 'danger' | 'outline';

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ComponentChildren }) {
  return <span class={cx(styles.badge, styles[tone])}>{children}</span>;
}
