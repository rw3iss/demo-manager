import { useState } from 'preact/hooks';
import { Modal } from '@/components/Modal/Modal';
import { Button } from '@/components/ui/Button';
import { ProjectFormFields, type ProjectFormValues } from '@/components/ProjectForm/ProjectFormFields';
import { useToast } from '@/app/ToastContext';
import { api, ApiError } from '@/services/api';
import type { ProjectView } from '@/services/types';
import styles from './NewProjectModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectView) => void;
}

const EMPTY: ProjectFormValues = {
  name: '',
  slug: '',
  description: '',
  commentsEnabled: false,
  pageloopProjectId: '',
};

export function NewProjectModal({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [value, setValue] = useState<ProjectFormValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [pageloopError, setPageloopError] = useState<string | undefined>();

  const change = (patch: Partial<ProjectFormValues>) => setValue((v) => ({ ...v, ...patch }));
  const close = () => {
    setValue(EMPTY);
    setNameError(undefined);
    setPageloopError(undefined);
    onClose();
  };

  const submit = async () => {
    if (!value.name.trim()) return setNameError('A name is required.');
    if (value.commentsEnabled && !value.pageloopProjectId.trim()) {
      return setPageloopError('A PageLoop project id is required when comments are enabled.');
    }
    setSubmitting(true);
    setNameError(undefined);
    setPageloopError(undefined);
    try {
      const project = await api.createProject({
        name: value.name.trim(),
        slug: value.slug.trim() || undefined,
        description: value.description.trim() || undefined,
        commentsEnabled: value.commentsEnabled,
        pageloopProjectId: value.commentsEnabled ? value.pageloopProjectId.trim() : undefined,
      });
      toast.push(`Project “${project.name}” created`, 'success');
      setValue(EMPTY);
      onCreated(project);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create project';
      if (e instanceof ApiError && (e.code === 'CONFLICT' || e.code === 'VALIDATION')) setNameError(msg);
      else toast.push(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New project"
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            Create project
          </Button>
        </>
      }
    >
      <ProjectFormFields
        value={value}
        onChange={change}
        mode="create"
        nameError={nameError}
        pageloopError={pageloopError}
      />
      <p class={styles.note}>An empty project is created; drop a .zip on its page to publish the first version.</p>
    </Modal>
  );
}
