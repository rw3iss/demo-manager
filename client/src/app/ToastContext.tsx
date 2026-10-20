import { createContext } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import styles from './Toast.module.scss';
import { cx } from '@/lib/cx';

export type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  push: (message: string, type?: ToastType) => void;
}

const ToastCtx = createContext<ToastApi>({ push: () => undefined });
let seq = 0;

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++seq;
      setToasts((t) => [...t, { id, type, message }]);
      window.setTimeout(() => remove(id), type === 'error' ? 6500 : 3500);
    },
    [remove],
  );

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div class={styles.toaster} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} class={cx(styles.toast, styles[t.type])} onClick={() => remove(t.id)}>
            <span class={styles.dot} />
            <span class={styles.msg}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastCtx);
}
