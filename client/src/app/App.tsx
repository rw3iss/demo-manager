import Router from 'preact-router';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider } from './ToastContext';
import { AppShell } from './AppShell';
import { Dashboard } from '@/pages/Dashboard/Dashboard';
import { ProjectDetail } from '@/pages/ProjectDetail/ProjectDetail';
import { BASE } from '@/lib/router';

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppShell>
          <Router>
            <Dashboard path={BASE} />
            <ProjectDetail path={`${BASE}/p/:slug`} />
            <Dashboard default />
          </Router>
        </AppShell>
      </ToastProvider>
    </ErrorBoundary>
  );
}
