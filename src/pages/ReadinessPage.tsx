import { Info, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { StatusIcon } from '@/components/lesson/StatusIcon';
import { Badge, Button, Card, PageHeader, Segmented, Select, TextArea, TextInput } from '@/components/ui';
import { COMPETENCIES, PROFILES } from '@/data/competencies';
import type { Competency, ProfileId } from '@/data/types';
import { cn } from '@/lib/cn';
import { lessonsForCompetency } from '@/lib/curriculum';
import {
  emptyReadinessEntry,
  getLessonStatus,
  READINESS_LEVELS,
  type EvidenceSource,
  type ReadinessLevel,
} from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  work: 'Work',
  personal: 'Personal project',
  learning: 'EngineerOS exercise',
};

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ReadinessPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { state } = useProgress();
  const profileParam = params.get('profile');
  const hashCompetency = COMPETENCIES.find((c) => `#${c.id}` === location.hash);
  const defaultProfile: ProfileId = hashCompetency && !hashCompetency.profiles.includes('fullstack') ? 'product-ui' : 'fullstack';
  const profileId: ProfileId = profileParam === 'product-ui' || profileParam === 'fullstack' ? profileParam : defaultProfile;
  const profile = PROFILES.find((p) => p.id === profileId)!;
  const competencies = COMPETENCIES.filter((c) => c.profiles.includes(profileId));

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    el?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  const counts = READINESS_LEVELS.map((l) => ({
    ...l,
    count: competencies.filter((c) => state.readiness[c.id]?.level === l.value).length,
  }));
  const unassessed = competencies.filter((c) => state.readiness[c.id]?.level === undefined).length;
  const evidenceCount = competencies.reduce((n, c) => n + (state.readiness[c.id]?.evidence.length ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Career readiness"
        title="Netflix readiness"
        description="Two target profiles, the competencies behind them, and the lessons that build each one. Rate yourself honestly and attach real evidence."
      />

      <div className="mb-8 flex gap-3 rounded-xl border border-line bg-subtle/40 p-4 text-[13.5px] leading-relaxed text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
        <p>
          This is a personal planning tool built from general, publicly described expectations for senior product engineers. It is{' '}
          <strong className="font-medium text-fg">not</strong> an official Netflix rubric, levelling guide, or readiness score. Check
          real job postings and Netflix’s public culture material for current expectations.
        </p>
      </div>

      <Segmented
        label="Target profile"
        value={profileId}
        onChange={(v) => setParams({ profile: v }, { replace: true })}
        options={PROFILES.map((p) => ({ value: p.id, label: p.id === 'fullstack' ? 'Full-stack product' : 'Senior product UI' }))}
      />

      <Card className="mt-5 p-5 sm:p-6">
        <div className="text-[12.5px] text-faint">{profile.level}</div>
        <h2 className="mt-1 text-[19px] font-semibold tracking-tight text-fg">{profile.name}</h2>
        <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-muted">{profile.summary}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {counts.map((c) => (
            <div key={c.value} className="rounded-lg border border-line px-3 py-2">
              <dt className="text-[11.5px] text-faint">{c.label}</dt>
              <dd className="text-[18px] font-semibold text-fg">{c.count}</dd>
            </div>
          ))}
          <div className="rounded-lg border border-line px-3 py-2">
            <dt className="text-[11.5px] text-faint">Unrated</dt>
            <dd className="text-[18px] font-semibold text-fg">{unassessed}</dd>
          </div>
          <div className="rounded-lg border border-line px-3 py-2">
            <dt className="text-[11.5px] text-faint">Evidence</dt>
            <dd className="text-[18px] font-semibold text-fg">{evidenceCount}</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-8 space-y-5">
        {competencies.map((c) => (
          <CompetencyCard key={c.id} competency={c} />
        ))}
      </div>
    </div>
  );
}

function CompetencyCard({ competency }: { competency: Competency }) {
  const { state, dispatch, lessons } = useProgress();
  const entry = state.readiness[competency.id] ?? emptyReadinessEntry();
  const supporting = lessonsForCompetency(lessons, competency.id);
  const done = supporting.filter((l) => state.lessons[l.slug]?.completedAt).length;
  const [adding, setAdding] = useState(false);
  const notesId = useId();

  return (
    <Card id={competency.id} className="scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-fg">{competency.name}</h3>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted">{competency.description}</p>
        </div>
        <div className="shrink-0">
          <div className="mb-1.5 text-[11.5px] text-faint md:text-right">Self-assessment</div>
          <div role="radiogroup" aria-label={`${competency.name} self-assessment`} className="flex flex-wrap gap-1">
            {READINESS_LEVELS.map((l) => {
              const active = entry.level === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={l.description}
                  onClick={() =>
                    dispatch({
                      type: 'setReadinessLevel',
                      competency: competency.id,
                      level: active ? undefined : (l.value as ReadinessLevel),
                    })
                  }
                  className={cn(
                    'h-7 rounded-md border px-2.5 text-[12.5px] transition-colors',
                    active ? 'border-accent bg-accent text-accent-fg' : 'border-line text-muted hover:border-faint/50 hover:text-fg',
                  )}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="text-[12px] font-medium text-faint">What good evidence looks like</div>
          <ul className="mt-2 space-y-1.5 text-[13.5px] text-muted">
            {competency.signals.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-faint" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-medium text-faint">Supporting lessons</span>
            <span className="font-mono text-[12px] text-faint">
              {done}/{supporting.length}
            </span>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {supporting.map((l) => (
              <li key={l.slug}>
                <Link
                  to={`/lesson/${l.slug}/learn`}
                  className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-[13.5px] text-muted transition-colors hover:bg-subtle hover:text-fg"
                >
                  <StatusIcon status={getLessonStatus(state.lessons[l.slug])} className="h-3.5 w-3.5" />
                  <span className="w-8 shrink-0 font-mono text-[11.5px] text-faint">W{l.week}</span>
                  <span className="truncate">{l.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <label htmlFor={notesId} className="text-[12px] font-medium text-faint">
          Reflection notes
        </label>
        <TextArea
          id={notesId}
          className="mt-2 min-h-[80px]"
          placeholder="Where are you strong? What's the gap? What would raise your rating one level?"
          value={entry.notes}
          onChange={(e) => dispatch({ type: 'setReadinessNotes', competency: competency.id, notes: e.target.value })}
        />

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12px] font-medium text-faint">Evidence ({entry.evidence.length})</span>
          {!adding && (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add evidence
            </Button>
          )}
        </div>
        {entry.evidence.length > 0 && (
          <ul className="mt-2 space-y-2">
            {entry.evidence.map((e) => (
              <li key={e.id} className="group rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-fg">{e.title}</span>
                      <Badge>{SOURCE_LABEL[e.source]}</Badge>
                    </div>
                    {e.description && <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted">{e.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'removeEvidence', competency: competency.id, id: e.id })}
                    className="rounded p-1 text-faint transition-colors hover:bg-subtle hover:text-danger"
                    aria-label={`Remove evidence: ${e.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {adding && <EvidenceForm competencyId={competency.id} onDone={() => setAdding(false)} />}
      </div>
    </Card>
  );
}

function EvidenceForm({ competencyId, onDone }: { competencyId: Competency['id']; onDone: () => void }) {
  const { dispatch } = useProgress();
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<EvidenceSource>('personal');
  const [description, setDescription] = useState('');
  const base = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    dispatch({
      type: 'addEvidence',
      competency: competencyId,
      item: { id: newId(), title: title.trim(), source, description: description.trim(), createdAt: new Date().toISOString() },
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-line bg-subtle/40 p-4">
      <div className="flex gap-2 rounded-md border border-warn/25 bg-warn/[0.06] p-2.5 text-[12.5px] leading-relaxed text-warn">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Describe what <em>you</em> did and the outcome in general terms. Leave out employer names, client names, internal system
          names, customer data, and anything under NDA. Data stays in this browser unless you export it.
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div>
          <label htmlFor={`${base}-title`} className="mb-1 block text-[12px] text-faint">
            What happened
          </label>
          <TextInput
            id={`${base}-title`}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Cut café search p95 from 900 ms to 120 ms"
          />
        </div>
        <div>
          <label htmlFor={`${base}-source`} className="mb-1 block text-[12px] text-faint">
            Source
          </label>
          <Select id={`${base}-source`} value={source} onChange={(e) => setSource(e.target.value as EvidenceSource)} className="w-full">
            <option value="work">Work (anonymised)</option>
            <option value="personal">Personal project</option>
            <option value="learning">EngineerOS exercise</option>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor={`${base}-desc`} className="mb-1 block text-[12px] text-faint">
          Situation, your action, the result (optional)
        </label>
        <TextArea
          id={`${base}-desc`}
          className="min-h-[90px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Context in one line. What you decided and why. Measurable result."
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" disabled={!title.trim()}>
          Save evidence
        </Button>
      </div>
    </form>
  );
}
