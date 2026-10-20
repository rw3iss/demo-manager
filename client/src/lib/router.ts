import { route } from 'preact-router';

/** The manager SPA is mounted under /manage; routes carry that prefix. */
export const BASE = '/manage';

export const paths = {
  dashboard: BASE,
  project: (slug: string) => `${BASE}/p/${slug}`,
};

export function navigate(to: string): void {
  route(to);
}
