import type { ValueTransformer } from 'typeorm';

/**
 * Typed view over a project's arbitrary `settings` jsonb column. New settings
 * groups can be added here without a schema change. The {@link parseProjectSettings}
 * normalizer fills defaults so consumers never deal with partial/legacy json.
 */
export interface CommentsSettings {
  /** Inject the PageLoop widget into published pages for in-page commenting. */
  enabled: boolean;
  /** PageLoop project id the widget binds to (required when enabled). */
  pageloopProjectId: string | null;
}

export interface ProjectSettings {
  comments: CommentsSettings;
}

export function defaultProjectSettings(): ProjectSettings {
  return { comments: { enabled: false, pageloopProjectId: null } };
}

/** Normalize raw jsonb (possibly partial/null/legacy) into a full ProjectSettings. */
export function parseProjectSettings(raw: unknown): ProjectSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const c = r.comments && typeof r.comments === 'object' ? (r.comments as Record<string, unknown>) : {};
  const id = typeof c.pageloopProjectId === 'string' ? c.pageloopProjectId.trim() : '';
  return {
    comments: {
      enabled: c.enabled === true,
      pageloopProjectId: id || null,
    },
  };
}

/** Persist a normalized object; hydrate with defaults applied. */
export const projectSettingsTransformer: ValueTransformer = {
  to: (value?: ProjectSettings | null): ProjectSettings => parseProjectSettings(value),
  from: (value: unknown): ProjectSettings => parseProjectSettings(value),
};
