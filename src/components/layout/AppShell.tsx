import { BookOpen, Compass, Monitor, Moon, Settings, Sun, Target } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { getOverallProgress } from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';
import { useTheme, type ThemePreference } from '@/state/ThemeContext';

const NAV = [
  { to: '/', label: 'Today', icon: Compass, end: true },
  { to: '/curriculum', label: 'Curriculum', icon: BookOpen, end: false },
  { to: '/readiness', label: 'Readiness', icon: Target, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fg text-[13px] font-bold text-canvas">E</span>
      <span className="text-[15px] font-semibold tracking-tight text-fg">EngineerOS</span>
    </div>
  );
}

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

function ThemeButton({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length]!;
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-muted transition-colors hover:bg-subtle hover:text-fg',
        className,
      )}
      aria-label={`Theme: ${preference}. Switch to ${next}.`}
      title={`Theme: ${preference}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="capitalize">{preference}</span>
    </button>
  );
}

function SidebarProgress() {
  const { state, lessons } = useProgress();
  const p = getOverallProgress(lessons, state);
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-baseline justify-between text-[12px]">
        <span className="text-muted">Curriculum</span>
        <span className="font-mono text-faint">
          {p.completed}/{p.total}
        </span>
      </div>
      <ProgressBar value={p.percent} label="Overall curriculum progress" tone="accent" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { persisted, syncStatus } = useProgress();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus and scroll to the top on navigation so keyboard and screen
  // reader users land on the new page.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
        className="sr-only z-50 rounded-md bg-fg px-3 py-2 text-sm text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-canvas px-3 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav aria-label="Primary" className="mt-8 flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-8 items-center gap-2.5 rounded-lg px-2 text-[14px] transition-colors',
                  isActive ? 'bg-subtle font-medium text-fg' : 'text-muted hover:bg-subtle/60 hover:text-fg',
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <SidebarProgress />
          <ThemeButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
        <Logo />
        <ThemeButton />
      </header>

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="px-4 pb-28 pt-6 outline-none sm:px-6 lg:ml-60 lg:px-10 lg:pb-16 lg:pt-10"
      >
        {!persisted && (
          <div role="status" className="mx-auto mb-6 max-w-5xl rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-[13.5px] text-warn">
            Your browser is blocking local storage, so progress can't be saved right now. Export a backup from Settings before
            closing this tab.
          </div>
        )}
        {syncStatus === 'error' && (
          <div role="status" className="mx-auto mb-6 max-w-5xl rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-[13.5px] text-warn">
            Progress couldn't be synced to the cloud. It is still saved in this browser and will sync after a reload.
          </div>
        )}
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors',
                isActive ? 'text-fg' : 'text-faint hover:text-fg',
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
