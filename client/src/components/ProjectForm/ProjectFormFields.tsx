import { Field, TextArea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { slugify } from '@/lib/slug';
import styles from './ProjectForm.module.scss';

export interface ProjectFormValues {
  name: string;
  slug: string;
  description: string;
  commentsEnabled: boolean;
  pageloopProjectId: string;
}

interface Props {
  value: ProjectFormValues;
  onChange: (patch: Partial<ProjectFormValues>) => void;
  mode: 'create' | 'edit';
  /** For edit mode: the current slug, to detect a change and warn. */
  originalSlug?: string;
  nameError?: string;
  slugError?: string;
  pageloopError?: string;
}

/** The project form fields, shared by the New Project + Project Settings modals. */
export function ProjectFormFields({ value, onChange, mode, originalSlug, nameError, slugError, pageloopError }: Props) {
  const effectiveSlug = value.slug.trim() || slugify(value.name) || '…';
  const slugChanged =
    mode === 'edit' && originalSlug !== undefined && value.slug.trim().toLowerCase() !== originalSlug;

  return (
    <>
      <Field
        label="Name"
        placeholder="Acme Redesign"
        value={value.name}
        error={nameError}
        onInput={(e) => onChange({ name: (e.target as HTMLInputElement).value })}
      />

      <div>
        <Field
          label={mode === 'create' ? 'Slug (optional)' : 'Slug'}
          placeholder={mode === 'create' ? 'auto from name' : ''}
          value={value.slug}
          error={slugError}
          hint={`Public URL: /${effectiveSlug}/`}
          onInput={(e) => onChange({ slug: (e.target as HTMLInputElement).value })}
        />
        {slugChanged && (
          <p class={styles.warn}>
            Changing the slug rewrites the already-published versions to the new slug.
          </p>
        )}
      </div>

      <TextArea
        label="Description (optional)"
        placeholder="What is this demo?"
        value={value.description}
        onInput={(e) => onChange({ description: (e.target as HTMLTextAreaElement).value })}
      />

      <div class={styles.comments}>
        <Toggle
          checked={value.commentsEnabled}
          label="Enable comments"
          onChange={(v) => onChange({ commentsEnabled: v })}
        />
        <span class={styles.sub}>
          Installs the PageLoop widget on this demo's published pages for in-page commenting.
        </span>
        {value.commentsEnabled && (
          <Field
            label="PageLoop project ID"
            placeholder="e.g. acme-demo"
            value={value.pageloopProjectId}
            error={pageloopError}
            hint="The PageLoop project the comments bind to."
            onInput={(e) => onChange({ pageloopProjectId: (e.target as HTMLInputElement).value })}
          />
        )}
      </div>
    </>
  );
}
