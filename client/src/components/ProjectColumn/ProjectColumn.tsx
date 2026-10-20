import styles from './ProjectColumn.module.scss';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/lib/cx';
import { formatRelativeTime } from '@/lib/format';
import { navigate, paths } from '@/lib/router';
import type { ProjectView } from '@/services/types';

/** Dashboard column: a project header with its versions listed newest-first.
 *  The whole card links to the project detail page. */
export function ProjectColumn({ project }: { project: ProjectView }) {
  const open = () => navigate(paths.project(project.slug));

  return (
    <article class={cx(styles.col, !project.enabled && styles.off)} onClick={open} tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}>
      <header class={styles.head}>
        <div class={styles.titleRow}>
          <h3 class={styles.name}>{project.name}</h3>
          {project.enabled ? (
            project.currentVersionNumber !== null ? (
              <Badge tone="primary">v{project.currentVersionNumber} live</Badge>
            ) : (
              <Badge tone="muted">no version</Badge>
            )
          ) : (
            <Badge tone="danger">disabled</Badge>
          )}
        </div>
        <div class={styles.slug}>/{project.slug}/</div>
      </header>

      <div class={styles.versions}>
        {project.versions.length === 0 && <div class={styles.empty}>No versions yet</div>}
        {project.versions.map((v) => (
          <div key={v.id} class={cx(styles.ver, !v.enabled && styles.verOff)}>
            <span class={styles.verNum}>v{v.number}</span>
            <span class={styles.verName}>{v.name ?? 'untitled'}</span>
            {v.isCurrent && <span class={styles.dot} title="current" />}
            <span class={styles.verTime}>{formatRelativeTime(v.createdAt)}</span>
          </div>
        ))}
      </div>

      <footer class={styles.foot}>
        <span class={styles.count}>
          {project.versionCount} version{project.versionCount === 1 ? '' : 's'}
        </span>
        <span class={styles.open}>Open →</span>
      </footer>
    </article>
  );
}
