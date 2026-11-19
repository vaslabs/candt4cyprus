import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * GitHub Pages serves project sites from /<repository>/.
 * Base path resolution (first match wins):
 *   1. VITE_BASE            explicit override, e.g. "/my-repo/" or "/"
 *   2. GITHUB_REPOSITORY    set automatically in GitHub Actions ("owner/repo")
 *   3. "/"                  local development
 */
function resolveBase(): string {
  const explicit = process.env.VITE_BASE;
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  return repo ? `/${repo}/` : '/';
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
});
