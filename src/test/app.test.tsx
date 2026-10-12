import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '@/App';
import { STORAGE_KEYS } from '@/lib/storage';
import { ProgressProvider } from '@/state/ProgressContext';
import { ThemeProvider } from '@/state/ThemeContext';
import { FIXTURE_LESSONS } from './fixtures';

function renderApp(path = '/') {
  return render(
    <ThemeProvider>
      <ProgressProvider lessons={FIXTURE_LESSONS}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </ProgressProvider>
    </ThemeProvider>,
  );
}

function stored() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.progress) ?? 'null');
}

describe('dashboard', () => {
  it('shows the current lesson and a start action', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Postgres indexes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start learning/i })).toHaveAttribute('href', '/lesson/lesson-1/learn');
    expect(screen.getByText('2 h').parentElement).toHaveTextContent('2 h remaining this week');
  });
});

describe('lesson flow', () => {
  it('walks through the three steps, completes the lesson, and advances', async () => {
    const user = userEvent.setup();
    renderApp('/lesson/lesson-1/learn');

    await user.click(screen.getByRole('button', { name: /finish learn to practice/i }));
    expect(screen.getByRole('heading', { name: 'Exercise 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Checklist A' }));
    await user.type(screen.getByLabelText(/exercise notes/i), 'Index scan 0.3ms');
    await user.click(screen.getByRole('button', { name: /finish practice to explain/i }));

    const explanation = screen.getByLabelText('Explain it.');
    await user.type(explanation, 'word '.repeat(25));
    await user.click(screen.getByRole('button', { name: /submit and compare/i }));
    expect(screen.getByText('Reference explanation text.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^complete lesson$/i }));
    expect(screen.getByRole('heading', { name: 'Lesson complete' })).toBeInTheDocument();

    const s = stored();
    expect(s.lessons['lesson-1'].completedAt).toBeTruthy();
    expect(s.lessons['lesson-1'].steps).toEqual({ learn: true, practice: true, explain: true });
    expect(s.lessons['lesson-1'].checklist).toEqual([0]);
    expect(s.lessons['lesson-1'].exerciseNotes).toBe('Index scan 0.3ms');

    await user.click(screen.getByRole('link', { name: /back to today/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'React rendering' })).toBeInTheDocument();
  });

  it('can mark a completed lesson incomplete', async () => {
    const user = userEvent.setup();
    renderApp('/lesson/lesson-2/explain');
    await user.click(screen.getByRole('button', { name: /^complete lesson$/i }));
    await user.click(screen.getAllByRole('button', { name: /mark incomplete/i })[0]!);
    expect(stored().lessons['lesson-2'].completedAt).toBeUndefined();
    expect(screen.getByRole('button', { name: /^complete lesson$/i })).toBeInTheDocument();
  });
});

describe('persistence', () => {
  it('restores progress and notes after a reload', async () => {
    const user = userEvent.setup();
    const first = renderApp('/lesson/lesson-1/practice');
    await user.type(screen.getByLabelText(/exercise notes/i), 'Remember me');
    first.unmount();

    renderApp('/lesson/lesson-1/practice');
    expect(screen.getByLabelText(/exercise notes/i)).toHaveValue('Remember me');
  });

  it('resumes an unfinished lesson from the dashboard', async () => {
    const user = userEvent.setup();
    const first = renderApp('/lesson/lesson-3/learn');
    await user.click(screen.getByRole('button', { name: /finish learn to practice/i }));
    first.unmount();

    renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'API pagination' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue learning/i })).toHaveAttribute('href', '/lesson/lesson-3/practice');
  });

  it('survives corrupt stored data without crashing', () => {
    window.localStorage.setItem(STORAGE_KEYS.progress, '{"version":1,"lessons":42}');
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Postgres indexes' })).toBeInTheDocument();
  });
});

describe('curriculum page', () => {
  it('filters lessons by search query', async () => {
    const user = userEvent.setup();
    renderApp('/curriculum');
    const list = () => screen.getAllByRole('list')[0]!;
    expect(within(list()).getAllByRole('link')).toHaveLength(3);
    await user.type(screen.getByRole('searchbox', { name: /search lessons/i }), 'pagination');
    expect(within(list()).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('API pagination')).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('changes the weekly mode, which the dashboard reflects', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(screen.getByRole('radio', { name: /light week/i }));
    expect(stored().settings.weekMode).toBe('light');
    await user.click(screen.getAllByRole('link', { name: /today/i })[0]!);
    expect(screen.getByText('Light task for 1.')).toBeInTheDocument();
  });

  it('rejects an invalid import file with a clear error', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const file = new File(['{"app":"other"}'], 'backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/choose a backup file/i), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not look like an EngineerOS backup/);
  });

  it('imports a valid backup after confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const backup = {
      app: 'engineeros',
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: { version: 1, lessons: { 'lesson-1': { completedAt: '2026-01-01T00:00:00.000Z' } }, readiness: {}, settings: { weekMode: 'standard' }, createdAt: '2026-01-01T00:00:00.000Z' },
    };
    await user.upload(screen.getByLabelText(/choose a backup file/i), new File([JSON.stringify(backup)], 'b.json', { type: 'application/json' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /import and replace/i }));
    expect(stored().lessons['lesson-1'].completedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('requires typing reset before wiping progress', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ version: 1, lessons: { 'lesson-1': { completedAt: '2026-01-01T00:00:00.000Z' } }, readiness: {}, settings: { weekMode: 'standard' }, createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    renderApp('/settings');
    await user.click(screen.getByRole('button', { name: /reset…/i }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: /reset everything/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/type reset/i), 'reset');
    await user.click(confirm);
    expect(stored().lessons).toEqual({});
  });
});
