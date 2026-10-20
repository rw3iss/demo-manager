import { useState } from 'preact/hooks';
import { Modal } from '@/components/Modal/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/app/ToastContext';
import { api } from '@/services/api';
import { formatBytes } from '@/lib/format';
import type { ProjectView } from '@/services/types';
import styles from './UploadModal.module.scss';

interface Props {
  open: boolean;
  project: ProjectView;
  file: File;
  onClose: () => void;
  onPublished: (project: ProjectView) => void;
}

export function UploadModal({ open, project, file, onClose, onPublished }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [promote, setPromote] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextNumber = project.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'file';

  const publish = async () => {
    setSubmitting(true);
    setError(null);
    setProgress(0);
    try {
      const updated = await api.publishVersion(project.slug, file, {
        name: name.trim() || undefined,
        promote,
        onProgress: setProgress,
      });
      toast.push(`Published v${nextNumber} of “${project.name}”`, 'success');
      onPublished(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      open={open}
      title="Publish new version"
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={publish} loading={submitting}>
            Publish v{nextNumber}
          </Button>
        </>
      }
    >
      <div class={styles.file}>
        <div class={styles.fileIcon}>{ext}</div>
        <div class={styles.fileMeta}>
          <div class={styles.fileName} title={file.name}>
            {file.name}
          </div>
          <div class={styles.fileSub}>
            {formatBytes(file.size)} · becomes <span class={styles.badge}>v{nextNumber}</span> of{' '}
            <span class={styles.mono}>/{project.slug}/</span>
          </div>
        </div>
      </div>

      <Field
        label="Version name / description (optional)"
        placeholder="e.g. Q2 homepage refresh"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />

      <div class={styles.promote}>
        <Toggle checked={promote} onChange={setPromote} label="Promote to current" />
        <span class={styles.promoteHint}>
          {promote
            ? `Visiting /${project.slug}/ will serve this version.`
            : 'Uploads without changing which version is current.'}
        </span>
      </div>

      {submitting && progress !== null && (
        <div class={styles.progress}>
          <div class={styles.bar} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {error && <div class={styles.error}>{error}</div>}
    </Modal>
  );
}
