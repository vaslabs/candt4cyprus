import {
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  FlaskConical,
  Gauge,
  Landmark,
  Menu,
  Moon,
  Scale,
  Sun,
  Monitor,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '../../lib/utils';
import { resolvedDark, useSettings, type Theme } from '../../state/settingsStore';
import { ScenarioBar } from '../ScenarioBar';

export const NAV = [
  { to: '/', label: 'Cyprus overview', Icon: Landmark },
  { to: '/replication', label: 'Paper replication', Icon: BookOpen },
  { to: '/automation', label: 'Automation simulator', Icon: Gauge },
  { to: '/policies', label: 'Policy comparison', Icon: Scale },
  { to: '/business', label: 'Company simulator', Icon: Building2 },
  { to: '/sensitivity', label: 'Sensitivity & uncertainty', Icon: FlaskConical },
  { to: '/methodology', label: 'Methodology & sources', Icon: BarChart3 },
  { to: '/report', label: 'Report', Icon: FileText },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useSettings();
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      aria-label={`Colour theme: ${theme}. Activate to switch.`}
      data-testid="theme-toggle"
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline capitalize">{theme}</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle('dark', resolvedDark(theme));
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, [theme]);
  const nav = (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {NAV.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-800/30 dark:text-brand-100'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="hidden border-r border-slate-200 bg-white px-3 py-5 lg:block dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-6 px-3 text-sm font-semibold leading-tight">
          Cyprus AI, Automation <br /> &amp; Social Insurance
          <span className="mt-1 block text-xs font-normal text-slate-500">Open research simulator</span>
        </p>
        {nav}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            data-testid="menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <ScenarioBar />
          </div>
          <ThemeToggle />
        </header>
        {open && (
          <div className="border-b border-slate-200 bg-white px-3 py-3 lg:hidden dark:border-slate-800 dark:bg-slate-900">
            {nav}
          </div>
        )}
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {children}
        </main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
          Results are model simulations under stated assumptions, not official forecasts. All calculations run
          in your browser; nothing is sent to a server.
        </footer>
      </div>
    </div>
  );
}
