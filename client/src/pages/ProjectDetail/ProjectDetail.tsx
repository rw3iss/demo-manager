import { useState } from 'preact/hooks';
import styles from './ProjectDetail.module.scss';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/app/ToastContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { UploadDropzone } from '@/components/UploadDropzone/UploadDropzone';
import { UploadModal } from '@/components/UploadModal/UploadModal';
import { ReplaceModal } from '@/components/ReplaceModal/ReplaceModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal/ProjectSettingsModal';
import { VersionBlock } from '@/components/VersionBlock/VersionBlock';
import { ConfirmDialog } from '@/components/Modal/ConfirmDialog';
import { BASE, navigate, paths } from '@/lib/router';
import type { RoutableProps } from 'preact-router';
import type { VersionView } from '@/services/types';

type Confirm = { kind: 'version'; number: number } | { kind: 'project' };

export function ProjectDetail({ slug }: RoutableProps & { slug?: string }) {
  const { project, setProject, error, notFound, loading, reload } = useProject(slug);
  const toast = useToast();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{ version: VersionView; file: File } | null>(null);
  const [busyVersion, setBusyVersion] = useState<number | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fail = (e: unknown) => toast.push(e instanceof Error ? e.message : 'Something went wrong', 'error');

  if (loading) return <Spinner label="Loading project" />;

  if (notFound) {
    return (
      <div class={styles.gone}>
        <h1>Project not found</h1>
        <p>No project matches “{slug}”.</p>
        <Button variant="ghost" onClick={() => navigate(BASE)}>
          ← Back to dashboard
        </Button>
      </div>
    );
  }
  if (error || !project) {
    return (
      <div class={styles.gone}>
        <h1>Couldn’t load project</h1>
        <p>{error}</p>
        <Button variant="ghost" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  const publicBase = project.publicUrl.slice(0, project.publicUrl.length - (project.slug.length + 2));

  const isAccepted = (file: File) => {
    const n = file.name.toLowerCase();
    return (
      n.endsWith('.zip') ||
      n.endsWith('.html') ||
      n.endsWith('.htm') ||
      file.type.includes('zip') ||
      file.type === 'text/html'
    );
  };

  const onFile = (file: File) => {
    if (!isAccepted(file)) {
      toast.push('Please choose a .zip or .html file.', 'error');
      return;
    }
    setPendingFile(file);
  };

  const onReplaceFile = (version: VersionView, file: File) => {
    if (!isAccepted(file)) {
      toast.push('Please choose a .zip or .html file.', 'error');
      return;
    }
    setReplaceTarget({ version, file });
  };

  const promote = async (v: VersionView) => {
    setBusyVersion(v.number);
    try {
      setProject(await api.promoteVersion(project.slug, v.number));
      toast.push(`v${v.number} is now current`, 'success');
    } catch (e) {
      fail(e);
    } finally {
      setBusyVersion(null);
    }
  };

  const toggleVersion = async (v: VersionView) => {
    setBusyVersion(v.number);
    try {
      setProject(await api.updateVersion(project.slug, v.number, { enabled: !v.enabled }));
      toast.push(`v${v.number} ${v.enabled ? 'disabled' : 'enabled'}`, 'success');
    } catch (e) {
      fail(e);
    } finally {
      setBusyVersion(null);
    }
  };

  const toggleProject = async () => {
    setProjectBusy(true);
    try {
      setProject(await api.updateProject(project.slug, { enabled: !project.enabled }));
      toast.push(`Project ${project.enabled ? 'disabled' : 'enabled'}`, 'success');
    } catch (e) {
      fail(e);
    } finally {
      setProjectBusy(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      if (confirm.kind === 'version') {
        setProject(await api.deleteVersion(project.slug, confirm.number));
        toast.push(`v${confirm.number} deleted`, 'success');
        setConfirm(null);
      } else {
        await api.deleteProject(project.slug);
        toast.push(`Project “${project.name}” deleted`, 'success');
        navigate(paths.dashboard);
      }
    } catch (e) {
      fail(e);
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div class={styles.page}>
      <a
        class={styles.back}
        href={BASE}
        onClick={(e) => {
          e.preventDefault();
          navigate(BASE);
        }}
      >
        ← All demos
      </a>

      <header class={styles.head}>
        <div class={styles.headMain}>
          <div class={styles.titleRow}>
            <h1>{project.name}</h1>
            {project.enabled ? (
              project.currentVersionNumber !== null ? (
                <Badge tone="primary">v{project.currentVersionNumber} live</Badge>
              ) : (
                <Badge tone="muted">no current version</Badge>
              )
            ) : (
              <Badge tone="danger">disabled</Badge>
            )}
          </div>
          <a class={styles.url} href={project.publicUrl} target="_blank" rel="noopener noreferrer">
            {project.publicUrl} ↗
          </a>
          {project.description && <p class={styles.desc}>{project.description}</p>}
        </div>
        <div class={styles.headActions}>
          <Button variant="ghost" onClick={() => setShowSettings(true)}>
            Settings
          </Button>
        </div>
      </header>

      <div class={styles.split}>
        <section class={styles.main}>
          <div class={styles.versionsHead}>
            <h2>Versions</h2>
            <span class={styles.count}>{project.versionCount}</span>
          </div>
          {project.versions.length === 0 ? (
            <div class={styles.noVersions}>No versions yet — drop a .zip in the panel to publish the first one.</div>
          ) : (
            <div class={styles.list}>
              {project.versions.map((v) => (
                <VersionBlock
                  key={v.id}
                  version={v}
                  publicBase={publicBase}
                  busy={busyVersion === v.number}
                  onPromote={() => promote(v)}
                  onReplaceFile={(file) => onReplaceFile(v, file)}
                  onToggleEnabled={() => toggleVersion(v)}
                  onDelete={() => setConfirm({ kind: 'version', number: v.number })}
                />
              ))}
            </div>
          )}
        </section>

        <aside class={styles.side}>
          <UploadDropzone onFile={onFile} compact />
        </aside>
      </div>

      {pendingFile && (
        <UploadModal
          open
          project={project}
          file={pendingFile}
          onClose={() => setPendingFile(null)}
          onPublished={(updated) => {
            setProject(updated);
            setPendingFile(null);
          }}
        />
      )}

      {replaceTarget && (
        <ReplaceModal
          project={project}
          version={replaceTarget.version}
          file={replaceTarget.file}
          onClose={() => setReplaceTarget(null)}
          onReplaced={(updated) => setProject(updated)}
        />
      )}

      {showSettings && (
        <ProjectSettingsModal
          project={project}
          projectBusy={projectBusy}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => {
            const slugChanged = updated.slug !== project.slug;
            setProject(updated);
            setShowSettings(false);
            if (slugChanged) navigate(paths.project(updated.slug));
          }}
          onToggleEnabled={toggleProject}
          onRequestDelete={() => {
            setShowSettings(false);
            setConfirm({ kind: 'project' });
          }}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'project' ? 'Delete project?' : `Delete v${confirm?.kind === 'version' ? confirm.number : ''}?`}
        message={
          confirm?.kind === 'project'
            ? `This permanently removes “${project.name}”, all ${project.versionCount} version(s), and their files. This cannot be undone.`
            : 'This permanently removes the version and its files. This cannot be undone.'
        }
        confirmLabel="Delete"
        danger
        loading={confirmLoading}
        onConfirm={runConfirm}
        onClose={() => !confirmLoading && setConfirm(null)}
      />
    </div>
  );
}
