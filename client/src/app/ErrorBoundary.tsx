import { Component } from 'preact';
import type { ComponentChildren } from 'preact';
import styles from './ErrorBoundary.module.scss';

interface Props {
  children: ComponentChildren;
}
interface State {
  error: Error | null;
}

/** Catches render-time crashes so a component bug shows a recoverable panel
 *  instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div class={styles.wrap}>
          <div class={styles.card}>
            <div class={styles.code}>Client error</div>
            <h1>Something broke in the UI</h1>
            <p>{this.state.error.message}</p>
            <button class={styles.btn} onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
