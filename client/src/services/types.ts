// Mirrors the server's serialized views + response envelope (server/src/projects/views.ts).

export interface VersionView {
  id: string;
  number: number;
  name: string | null;
  enabled: boolean;
  sizeBytes: number;
  fileCount: number;
  isCurrent: boolean;
  publicPath: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSettings {
  comments: {
    enabled: boolean;
    pageloopProjectId: string | null;
  };
}

export interface ProjectView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  enabled: boolean;
  currentVersionNumber: number | null;
  versionCount: number;
  publicUrl: string;
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
  versions: VersionView[];
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
