import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, ApiError } from '@/services/api';
import type { ProjectView } from '@/services/types';

/** Loads a single project's detail (with versions), with reload + error state. */
export function useProject(slug: string | undefined) {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setProject(await api.getProject(slug));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { project, setProject, error, notFound, loading, reload };
}
