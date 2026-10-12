import { Clock, Download, Feather, HardDrive, RotateCcw, Upload, Zap } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Card, ConfirmDialog, PageHeader, SectionLabel, Segmented, TextInput } from '@/components/ui';
import { backupFileName, createBackup, parseBackup, type ParseResult } from '@/lib/backup';
import { cn } from '@/lib/cn';
import type { WeekMode } from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';
import { useTheme, type ThemePreference } from '@/state/ThemeContext';

const MODES: { value: WeekMode; title: string; time: string; icon: typeof Clock; description: string }[] = [
  {
    value: 'light',
    title: 'Light week',
    time: '30 min',
    icon: Feather,
    description: 'One minimum-viable task per lesson. The lesson stays open so you can finish it in a later week.',
  },
  {
    value: 'standard',
    title: 'Standard week',
    time: '2 hours',
    icon: Clock,
    description: '30 min learn, 60 min hands-on practice, 30 min explaining. The default, and always fully usable.',
  },
  {
    value: 'intensive',
    title: 'Intensive week',
    time: '4 hours',
    icon: Zap,
    description: 'The standard lesson plus optional extra practice. More reps, not a harder core.',
  },
];

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function SettingsPage() {
  const { state, dispatch } = useProgress();
  const { preference, setPreference } = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Extract<ParseResult, { ok: true }> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(createBackup(state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotice('Backup downloaded.');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setNotice(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setImportError('That file is larger than 10 MB, which is far bigger than any EngineerOS backup.');
      return;
    }
    const result = parseBackup(await readFileText(file));
    if (result.ok) {
      setImportError(null);
      setPending(result);
    } else {
      setImportError(result.error);
    }
  };

  const completed = Object.values(state.lessons).filter((l) => l.completedAt).length;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="How much time you have this week, how the app looks, and your data." />

      <section aria-labelledby="mode-h">
        <SectionLabel>
          <span id="mode-h">Weekly commitment</span>
        </SectionLabel>
        <div role="radiogroup" aria-labelledby="mode-h" className="mt-3 grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const active = state.settings.weekMode === m.value;
            const Icon = m.icon;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => dispatch({ type: 'setWeekMode', mode: m.value })}
                className={cn(
                  'rounded-xl border bg-surface p-4 text-left transition-colors',
                  active ? 'border-accent ring-4 ring-accent/10' : 'border-line hover:border-faint/50',
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon className={cn('h-4 w-4', active ? 'text-accent' : 'text-faint')} aria-hidden />
                  <span className="font-mono text-[12px] text-faint">{m.time}</span>
                </div>
                <div className="mt-3 text-[14.5px] font-medium text-fg">{m.title}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{m.description}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12.5px] text-faint">Change this any week. It never changes which lesson you're on.</p>
      </section>

      <section className="mt-12">
        <SectionLabel>Appearance</SectionLabel>
        <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
          <div>
            <div className="text-[14.5px] font-medium text-fg">Theme</div>
            <div className="text-[12.5px] text-muted">System follows your OS setting.</div>
          </div>
          <Segmented<ThemePreference>
            label="Theme"
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </section>

      <section className="mt-12">
        <SectionLabel>Your data</SectionLabel>
        <Card className="mt-3 divide-y divide-line">
          <div className="flex gap-3 p-4 text-[13.5px] leading-relaxed text-muted">
            <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
            <p>
              Progress is stored only in this browser’s local storage. It doesn’t sync between devices or browsers, and clearing site
              data deletes it. Export a backup regularly, and import it to move to another device.
            </p>
          </div>

          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[14.5px] font-medium text-fg">Export progress</div>
              <div className="text-[12.5px] text-muted">
                {completed} completed lesson{completed === 1 ? '' : 's'}, notes, reflections, and readiness evidence as JSON.
              </div>
            </div>
            <Button onClick={exportProgress}>
              <Download className="h-4 w-4" aria-hidden /> Export JSON
            </Button>
          </div>

          <div className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[14.5px] font-medium text-fg">Import progress</div>
                <div className="text-[12.5px] text-muted">Replaces everything here with the contents of a backup file.</div>
              </div>
              <Button onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden /> Import JSON
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Choose a backup file to import"
                onChange={onFile}
                tabIndex={-1}
              />
            </div>
            {importError && (
              <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2 text-[13px] text-danger">
                Import failed: {importError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[14.5px] font-medium text-fg">Reset progress</div>
              <div className="text-[12.5px] text-muted">Deletes all progress, notes, and evidence in this browser.</div>
            </div>
            <Button variant="secondary" className="text-danger" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Reset…
            </Button>
          </div>
        </Card>
        {notice && (
          <p role="status" className="mt-3 text-[13px] text-success">
            {notice}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        title="Replace current progress?"
        confirmLabel="Import and replace"
        tone="primary"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          dispatch({ type: 'replaceState', state: pending.state });
          setNotice(
            `Imported ${pending.summary.lessons} lesson record${pending.summary.lessons === 1 ? '' : 's'} (${pending.summary.completed} completed).`,
          );
          setPending(null);
        }}
      >
        {pending && (
          <p>
            The backup contains {pending.summary.lessons} lesson record{pending.summary.lessons === 1 ? '' : 's'} (
            {pending.summary.completed} completed) and {pending.summary.evidence} evidence item
            {pending.summary.evidence === 1 ? '' : 's'}. Your current data in this browser will be replaced. Export first if you want
            to keep it.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={resetOpen}
        title="Reset all progress?"
        confirmLabel="Reset everything"
        confirmDisabled={resetText.trim().toLowerCase() !== 'reset'}
        onCancel={() => {
          setResetOpen(false);
          setResetText('');
        }}
        onConfirm={() => {
          dispatch({ type: 'reset' });
          setResetOpen(false);
          setResetText('');
          setNotice('Progress reset.');
        }}
      >
        <p>This permanently deletes your lesson progress, notes, explanations, and readiness evidence from this browser.</p>
        <label className="mt-3 block text-[13px] text-muted" htmlFor="reset-confirm">
          Type <strong className="font-mono text-fg">reset</strong> to confirm.
        </label>
        <TextInput id="reset-confirm" className="mt-1.5" value={resetText} onChange={(e) => setResetText(e.target.value)} autoComplete="off" />
      </ConfirmDialog>
    </div>
  );
}
