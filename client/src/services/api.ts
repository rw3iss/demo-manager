import type { ApiErrorShape, ProjectView } from './types';

const API_BASE = '/api/v1';

/** Typed error carrying the server's stable code so the UI can react/explain. */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError('Network error — is the server reachable?', 'NETWORK', 0);
  }

  const json = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: ApiErrorShape }
    | null;

  if (!res.ok || !json || json.success === false) {
    const err = json && json.success === false ? json.error : undefined;
    throw new ApiError(err?.message ?? res.statusText ?? 'Request failed', err?.code ?? 'INTERNAL', res.status, err?.details);
  }
  return json.data;
}

function jsonBody(body: unknown): RequestInit {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export interface PublishOptions {
  name?: string;
  promote: boolean;
  onProgress?: (fraction: number) => void;
}

export const api = {
  listProjects: () => request<ProjectView[]>('/projects'),

  getProject: (slug: string) => request<ProjectView>(`/projects/${encodeURIComponent(slug)}`),

  createProject: (body: {
    name: string;
    slug?: string;
    description?: string;
    commentsEnabled?: boolean;
    pageloopProjectId?: string;
  }) => request<ProjectView>('/projects', { method: 'POST', ...jsonBody(body) }),

  updateProject: (
    slug: string,
    body: {
      name?: string;
      slug?: string;
      description?: string;
      enabled?: boolean;
      commentsEnabled?: boolean;
      pageloopProjectId?: string;
    },
  ) => request<ProjectView>(`/projects/${encodeURIComponent(slug)}`, { method: 'PATCH', ...jsonBody(body) }),

  deleteProject: (slug: string) =>
    request<{ slug: string; deleted: boolean }>(`/projects/${encodeURIComponent(slug)}`, { method: 'DELETE' }),

  promoteVersion: (slug: string, number: number) =>
    request<ProjectView>(`/projects/${encodeURIComponent(slug)}/versions/${number}/promote`, { method: 'POST' }),

  updateVersion: (slug: string, number: number, body: { name?: string; enabled?: boolean }) =>
    request<ProjectView>(`/projects/${encodeURIComponent(slug)}/versions/${number}`, { method: 'PATCH', ...jsonBody(body) }),

  deleteVersion: (slug: string, number: number) =>
    request<ProjectView>(`/projects/${encodeURIComponent(slug)}/versions/${number}`, { method: 'DELETE' }),

  /** Replace an existing version's files (PUT multipart). `promote` optionally
   *  makes it current. The modal shows a spinner, so no upload-progress needed. */
  replaceVersion: (slug: string, number: number, file: File, opts: { promote: boolean }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('promote', String(opts.promote));
    return request<ProjectView>(`/projects/${encodeURIComponent(slug)}/versions/${number}`, {
      method: 'PUT',
      body: form,
    });
  },

  /**
   * Upload a zip as a new version. Uses XHR (not fetch) so we can report upload
   * progress for the modal's progress bar.
   */
  publishVersion(slug: string, file: File, opts: PublishOptions): Promise<ProjectView> {
    return new Promise<ProjectView>((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      if (opts.name) form.append('name', opts.name);
      form.append('promote', String(opts.promote));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/projects/${encodeURIComponent(slug)}/versions`);
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded / e.total);
      };
      xhr.onerror = () => reject(new ApiError('Upload failed — network error.', 'NETWORK', 0));
      xhr.onload = () => {
        const body = xhr.response as
          | { success: true; data: ProjectView }
          | { success: false; error: ApiErrorShape }
          | null;
        if (xhr.status >= 200 && xhr.status < 300 && body && body.success) {
          resolve(body.data);
        } else {
          const err = body && !body.success ? body.error : undefined;
          reject(new ApiError(err?.message ?? 'Upload failed', err?.code ?? 'INTERNAL', xhr.status, err?.details));
        }
      };
      xhr.send(form);
    });
  },
};
