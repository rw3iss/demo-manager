import type { ComponentChildren } from 'preact';
import styles from './AppShell.module.scss';
import logoUrl from '@/assets/vendidit-check.svg';
import { BASE, navigate } from '@/lib/router';

/** Global frame: a slim sticky top bar (brand → dashboard) over the page. */
export function AppShell({ children }: { children: ComponentChildren }) {
  return (
    <div class={styles.shell}>
      <header class={styles.bar}>
        <a
          class={styles.brand}
          href={BASE}
          onClick={(e) => {
            e.preventDefault();
            navigate(BASE);
          }}
        >
          <img class={styles.mark} src={logoUrl} alt="Vendidit" width="30" height="18" />
          <span class={styles.name}>demo</span>
          <span class={styles.sep}>·</span>
          <span class={styles.sub}>manager</span>
        </a>
        <div class={styles.spacer} />
        <span class={styles.hint}>static demos &amp; versions</span>
      </header>
      <main class={styles.main}>{children}</main>
    </div>
  );
}
