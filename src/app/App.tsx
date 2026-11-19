import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { AppShell } from '../components/layout/AppShell';

// Each section is code-split; charts and the economics stack load only where needed.
const Overview = lazy(() => import('../pages/Overview'));
const Replication = lazy(() => import('../pages/Replication'));
const Automation = lazy(() => import('../pages/Automation'));
const Policies = lazy(() => import('../pages/Policies'));
const Business = lazy(() => import('../pages/Business'));
const Sensitivity = lazy(() => import('../pages/Sensitivity'));
const Methodology = lazy(() => import('../pages/Methodology'));
const Report = lazy(() => import('../pages/Report'));

export function App() {
  return (
    // HashRouter: deep links and refreshes work on GitHub Pages without server-side fallback.
    <HashRouter>
      <AppShell>
        <Suspense fallback={<p role="status">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/replication" element={<Replication />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/business" element={<Business />} />
            <Route path="/sensitivity" element={<Sensitivity />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/report" element={<Report />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </Suspense>
      </AppShell>
    </HashRouter>
  );
}
