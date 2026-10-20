import { useEffect, useState } from 'preact/hooks';
import type { RoutableProps } from 'preact-router';
import styles from './Dashboard.module.scss';
import { useProjects } from '@/hooks/useProjects';
import { ProjectColumn } from '@/components/ProjectColumn/ProjectColumn';
import { NewProjectModal } from '@/components/NewProjectModal/NewProjectModal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { navigate, paths } from '@/lib/router';

export function Dashboard(_props: RoutableProps) {
  const { projects, error, loading, reload } = useProjects();
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Throttle the filter ~100ms after typing stops.
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 100);
    return () => window.clearTimeout(t);
  }, [query]);

  const q = debounced.trim().toLowerCase();
  const shown =
    projects && q
      ? projects.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      : (projects ?? []);

  const subtitle = !projects
    ? 'Loading…'
    : q
      ? `${shown.length} of ${projects.length}`
      : `${projects.length} project${projects.length === 1 ? '' : 's'}`;

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <div class={styles.headTitle}>
          <h1 class={styles.title}>Demos</h1>
          <p class={styles.subtitle}>{subtitle}</p>
        </div>
        {!loading && !error && projects && projects.length > 0 && (
          <input
            type="search"
            class={styles.search}
            placeholder="Search projects…"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        )}
        <Button class={styles.newBtn} variant="primary" onClick={() => setShowNew(true)}>
          + New project
        </Button>
      </div>

      {loading && <Spinner label="Loading projects" />}

      {!loading && error && (
        <div class={styles.error}>
          <p>{error}</p>
          <Button variant="ghost" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && projects && projects.length === 0 && (
        <div class={styles.empty}>
          <div class={styles.emptyMark} />
          <h2>No demos yet</h2>
          <p>Create a project, then drop a .zip to publish its first version.</p>
          <Button variant="primary" onClick={() => setShowNew(true)}>
            + New project
          </Button>
        </div>
      )}

      {!loading && !error && projects && projects.length > 0 && shown.length === 0 && (
        <div class={styles.noMatch}>No projects match “{debounced.trim()}”.</div>
      )}

      {!loading && !error && shown.length > 0 && (
        <div class={styles.grid}>
          {shown.map((p) => (
            <ProjectColumn key={p.id} project={p} />
          ))}
        </div>
      )}

      <NewProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(p) => {
          setShowNew(false);
          navigate(paths.project(p.slug));
        }}
      />
    </div>
  );
}
