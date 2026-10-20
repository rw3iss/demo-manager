# demo-manager API

Base: `/api/v1`. JSON. Every response is an envelope:

```jsonc
{ "success": true,  "data": <payload> }
{ "success": false, "error": { "code": "VALIDATION", "message": "…", "details": { } } }
```

Error codes: `VALIDATION` (400), `NOT_FOUND` (404), `CONFLICT` (409),
`PAYLOAD_TOO_LARGE` (413), `BAD_ARCHIVE` (422), `NO_INDEX_HTML` (422),
`INTERNAL` (500).

## Types

```ts
interface VersionView {
  id: string; number: number; name: string | null;
  enabled: boolean; sizeBytes: number; fileCount: number;
  isCurrent: boolean; publicPath: string;        // "/acme/3/"
  createdAt: number; updatedAt: number;          // epoch seconds
}
interface ProjectSettings {
  comments: { enabled: boolean; pageloopProjectId: string | null };
}
interface ProjectView {
  id: string; slug: string; name: string; description: string | null;
  enabled: boolean; currentVersionNumber: number | null; versionCount: number;
  publicUrl: string;                             // "https://demos.vendidit.com/acme/"
  settings: ProjectSettings;
  createdAt: number; updatedAt: number;
  versions: VersionView[];                       // newest first
}
```

## Endpoints

| Method & path | Body | Returns |
|---|---|---|
| `GET /projects` | — | `ProjectView[]` |
| `POST /projects` | `{ name, slug?, description?, commentsEnabled?, pageloopProjectId? }` | `ProjectView` (201) |
| `GET /projects/:slug` | — | `ProjectView` |
| `PATCH /projects/:slug` | `{ name?, slug?, description?, enabled?, commentsEnabled?, pageloopProjectId? }` | `ProjectView` |
| `DELETE /projects/:slug` | — | `{ slug, deleted: true }` |
| `POST /projects/:slug/versions` | multipart: `file` (zip or .html/.htm), `name?`, `promote?` | `ProjectView` (201) |
| `PUT /projects/:slug/versions/:number` | multipart: `file` (zip or .html/.htm), `promote?` | `ProjectView` |
| `PATCH /projects/:slug/versions/:number` | `{ name?, enabled? }` | `ProjectView` |
| `POST /projects/:slug/versions/:number/promote` | — | `ProjectView` |
| `DELETE /projects/:slug/versions/:number` | — | `ProjectView` |
| `GET /healthz` | — | `{ status, uptimeSec }` |

Notes:
- `promote` defaults to **true** on `POST` (new version). On `PUT` (replace) it
  defaults to **false** — replace only swaps that version's files (same html
  validation as publish), updates its `updatedAt`, and promotes only if asked.
  The live files are untouched if the new zip is invalid.
- Mutating a version returns the **whole** updated project (so a client refreshes
  in one round-trip). Deleting/disabling the current version repoints "current"
  to the latest remaining enabled version (or null).
- The `file` may be a **zip** or a **single `.html`/`.htm` file**. A lone html
  file is stored directly as the version's `index.html`.
- **Comments (PageLoop):** `commentsEnabled` requires `pageloopProjectId`. When
  enabled, every newly published/replaced version has the PageLoop widget baked
  into its HTML (pointing at `PAGELOOP_ENDPOINT`, bound to the project id).
  Toggling the setting on `PATCH` also **retro-applies to all existing versions**:
  enabling (or changing `pageloopProjectId`) re-injects the widget into every
  published version; disabling strips it from every version. Retro-apply is
  best-effort — a failure is logged but doesn't fail the request, since future
  publishes still honor the stored setting.
- **Slug change** (`PATCH` with a new `slug`): the new slug must be free
  (else `CONFLICT`); the on-disk project dir is renamed so all published versions
  move to the new slug.
- Slugs are lowercase kebab; reserved words (`api`, `manage`, `healthz`, …) are
  rejected. A single wrapping folder in the zip is auto-flattened. The zip root
  must then have an `index.html` — or exactly one `.html`/`.htm` file, which is
  renamed to `index.html`. Zero or multiple html files in the root is rejected
  (`NO_INDEX_HTML`).

## Auth (future)

Public today. When auth lands, send `Authorization: Bearer <jwt>` (HS256 from
`@vendidit/auth-server`); the CLI already forwards `DEMO_TOKEN`.
