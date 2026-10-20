import { useCallback, useEffect, useState } from 'preact/hooks';
import { api } from '@/services/api';
import type { ProjectView } from '@/services/types';

/** Loads the project list for the dashboard, with reload + error state. */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await api.listProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { projects, error, loading, reload, setProjects };
}
