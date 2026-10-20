import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from '@/components/Modal/Modal';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/services/api';
import { formatBytes } from '@/lib/format';
import type { ProjectView, VersionView } from '@/services/types';
import styles from './ReplaceModal.module.scss';

type Phase = 'confirm' | 'loading' | 'success' | 'error';

interface Props {
  project: ProjectView;
  version: VersionView;
  file: File;
  onClose: () => void;
  onReplaced: (project: ProjectView) => void;
}

/**
 * Confirm replacing a version's files with a chosen zip, then run it:
 * confirm → loading spinner → success (auto-closes after 2s; the manual Close
 * button cancels that timer).
 */
export function ReplaceModal({ project, version, file, onClose, onReplaced }: Props) {
  const [promote, setPromote] = useState(version.isCurrent);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'file';

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  // Cancel any pending auto-close if the modal unmounts.
  useEffect(() => clearTimer, []);

  const close = () => {
    clearTimer();
    onClose();
  };

  const run = async () => {
    setPhase('loading');
    setError(null);
    try {
      const updated = await api.replaceVersion(project.slug, version.number, file, { promote });
      onReplaced(updated); // refresh the data behind the modal (does NOT close it)
      setPhase('success');
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onClose();
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Replace failed');
      setPhase('error');
    }
  };

  let footer = null;
  if (phase === 'confirm') {
    footer = (
      <>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button variant="primary" onClick={run}>
          Replace v{version.number}
        </Button>
      </>
    );
  } else if (phase === 'success' || phase === 'error') {
    footer = (
      <Button variant="ghost" onClick={close}>
        Close
      </Button>
    );
  }

  return (
    <Modal
      open
      title={`Replace version ${version.number}`}
      onClose={() => {
        if (phase !== 'loading') close();
      }}
      footer={footer}
    >
      {phase === 'confirm' && (
        <>
          <p class={styles.warn}>
            This permanently overwrites the files of <strong>v{version.number}</strong> of “{project.name}”
            with the uploaded package. Other versions are untouched.
          </p>
          <div class={styles.file}>
            <div class={styles.fileIcon}>{ext}</div>
            <div class={styles.fileMeta}>
              <div class={styles.fileName} title={file.name}>
                {file.name}
              </div>
              <div class={styles.fileSub}>
                {formatBytes(file.size)} · replaces{' '}
                <span class={styles.mono}>
                  /{project.slug}/{version.number}/
                </span>
              </div>
            </div>
          </div>
          <div class={styles.promote}>
            <Toggle checked={promote} onChange={setPromote} label="Promote to current" />
            <span class={styles.promoteHint}>
              {promote
                ? `Visiting /${project.slug}/ will serve this version.`
                : 'Leaves the current version unchanged.'}
            </span>
          </div>
        </>
      )}

      {phase === 'loading' && <Spinner label="Please wait…" />}

      {phase === 'success' && (
        <div class={styles.center}>
          <div class={styles.check}>✓</div>
          <p class={styles.successMsg}>Version {version.number} replaced</p>
          <p class={styles.centerSub}>This window closes automatically.</p>
        </div>
      )}

      {phase === 'error' && <div class={styles.errorBox}>{error}</div>}
    </Modal>
  );
}
