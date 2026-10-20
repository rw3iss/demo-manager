import { useState } from 'preact/hooks';
import { Modal } from '@/components/Modal/Modal';
import { Button } from '@/components/ui/Button';
import { ProjectFormFields, type ProjectFormValues } from '@/components/ProjectForm/ProjectFormFields';
import { useToast } from '@/app/ToastContext';
import { api, ApiError } from '@/services/api';
import type { ProjectView } from '@/services/types';
import styles from './ProjectSettingsModal.module.scss';

interface Props {
  project: ProjectView;
  projectBusy?: boolean;
  onClose: () => void;
  onSaved: (project: ProjectView) => void;
  onToggleEnabled: () => void;
  onRequestDelete: () => void;
}

function fromProject(p: ProjectView): ProjectFormValues {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? '',
    commentsEnabled: p.settings.comments.enabled,
    pageloopProjectId: p.settings.comments.pageloopProjectId ?? '',
  };
}

export function ProjectSettingsModal({ project, projectBusy, onClose, onSaved, onToggleEnabled, onRequestDelete }: Props) {
  const toast = useToast();
  const [value, setValue] = useState<ProjectFormValues>(() => fromProject(project));
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [slugError, setSlugError] = useState<string | undefined>();
  const [pageloopError, setPageloopError] = useState<string | undefined>();

  const change = (patch: Partial<ProjectFormValues>) => setValue((v) => ({ ...v, ...patch }));

  const save = async () => {
    if (!value.name.trim()) return setNameError('A name is required.');
    if (value.commentsEnabled && !value.pageloopProjectId.trim()) {
      return setPageloopError('A PageLoop project id is required when comments are enabled.');
    }
    setSubmitting(true);
    setNameError(undefined);
    setSlugError(undefined);
    setPageloopError(undefined);
    try {
      const updated = await api.updateProject(project.slug, {
        name: value.name.trim(),
        slug: value.slug.trim() || project.slug,
        description: value.description.trim(),
        commentsEnabled: value.commentsEnabled,
        pageloopProjectId: value.commentsEnabled ? value.pageloopProjectId.trim() : undefined,
      });
      toast.push('Project settings saved', 'success');
      onSaved(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save settings';
      if (e instanceof ApiError && e.code === 'CONFLICT') setSlugError(msg);
      else if (e instanceof ApiError && e.code === 'VALIDATION') {
        if (/pageloop/i.test(msg)) setPageloopError(msg);
        else setSlugError(msg);
      } else toast.push(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="Project settings"
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={submitting}>
            Save changes
          </Button>
        </>
      }
    >
      <ProjectFormFields
        value={value}
        onChange={change}
        mode="edit"
        originalSlug={project.slug}
        nameError={nameError}
        slugError={slugError}
        pageloopError={pageloopError}
      />

      <div class={styles.danger}>
        <span class={styles.dangerLabel}>Danger zone</span>
        <div class={styles.dangerRow}>
          <Button variant="ghost" onClick={onToggleEnabled} loading={projectBusy}>
            {project.enabled ? 'Disable project' : 'Enable project'}
          </Button>
          <Button variant="danger" onClick={onRequestDelete} disabled={submitting}>
            Delete project
          </Button>
        </div>
      </div>
    </Modal>
  );
}
