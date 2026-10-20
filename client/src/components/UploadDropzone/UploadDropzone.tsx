import { useRef, useState } from 'preact/hooks';
import styles from './UploadDropzone.module.scss';
import { cx } from '@/lib/cx';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
}

/** Drag-and-drop (or click-to-browse) zone for a .zip. Emits the chosen file;
 *  the caller validates + opens the confirmation modal. */
export function UploadDropzone({ onFile, disabled, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      class={cx(styles.zone, compact && styles.compact, drag && styles.drag, disabled && styles.disabled)}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) pick(e.dataTransfer?.files ?? null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,.html,.htm,text/html"
        class={styles.input}
        onChange={(e) => {
          pick((e.target as HTMLInputElement).files);
          (e.target as HTMLInputElement).value = '';
        }}
      />
      <div class={styles.icon}>↑</div>
      <div class={styles.headline}>
        Drop a <span class={styles.mono}>.zip</span> or <span class={styles.mono}>.html</span> to publish a new version
      </div>
      <div class={styles.sub}>or click to browse · a zip (with index.html), or a single .html file</div>
    </div>
  );
}
