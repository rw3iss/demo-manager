import { useRef } from 'preact/hooks';
import styles from './VersionBlock.module.scss';
import { cx } from '@/lib/cx';
import { formatRelativeTime } from '@/lib/format';
import type { VersionView } from '@/services/types';

interface Props {
  version: VersionView;
  publicBase: string; // absolute origin, e.g. https://demos.ryanweiss.net
  busy?: boolean;
  onPromote: () => void;
  onReplaceFile: (file: File) => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}

/**
 * A version as a simple floating row. Clicking the row opens the demo in a new
 * tab; the action buttons (make-current / replace / disable / delete) surface on
 * hover at the end of the row and stop the click from propagating to the row.
 * "Replace" opens a file picker and hands the chosen zip up to the page.
 */
export function VersionBlock({
  version,
  publicBase,
  busy,
  onPromote,
  onReplaceFile,
  onToggleEnabled,
  onDelete,
}: Props) {
  const viewUrl = publicBase + version.publicPath;
  const fileInput = useRef<HTMLInputElement>(null);
  const open = () => window.open(viewUrl, '_blank', 'noopener,noreferrer');
  const act = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      class={cx(styles.row, version.isCurrent && styles.current, !version.enabled && styles.off)}
      onClick={open}
      title={`Open ${viewUrl}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
    >
      <div class={styles.left}>
        <span class={styles.num}>v{version.number}</span>
        {version.isCurrent && <span class={styles.chip}>current</span>}
        {!version.enabled && <span class={cx(styles.chip, styles.chipOff)}>disabled</span>}
      </div>

      <div class={styles.mid}>
        {version.name && <span class={styles.name}>{version.name}</span>}
        <span class={styles.time}>{formatRelativeTime(version.updatedAt)}</span>
      </div>

      <div class={styles.actions} onClick={(e) => e.stopPropagation()}>
        {!version.isCurrent && version.enabled && (
          <button class={styles.act} disabled={busy} onClick={act(onPromote)}>
            Make current
          </button>
        )}
        <button class={styles.act} disabled={busy} onClick={act(() => fileInput.current?.click())}>
          Replace
        </button>
        <button class={styles.act} disabled={busy} onClick={act(onToggleEnabled)}>
          {version.enabled ? 'Disable' : 'Enable'}
        </button>
        <button class={cx(styles.act, styles.danger)} disabled={busy} onClick={act(onDelete)}>
          Delete
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip,.html,.htm,text/html"
          class={styles.hiddenInput}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = '';
            if (file) onReplaceFile(file);
          }}
        />
      </div>
    </div>
  );
}
