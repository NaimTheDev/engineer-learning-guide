import { Lightbulb, Mountain, Zap } from 'lucide-react';
import { BulletList, CheckItem, CodeBlock, Disclosure, NumberedList, RichText, SectionLabel, TextArea } from '@/components/ui';
import type { Lesson } from '@/data/types';
import { emptyLessonProgress, type WeekMode } from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';
import { SaveIndicator } from './SaveIndicator';

export function PracticeStep({ lesson, mode }: { lesson: Lesson; mode: WeekMode }) {
  const { state, dispatch } = useProgress();
  const lp = state.lessons[lesson.slug] ?? emptyLessonProgress();
  const ex = lesson.exercise;

  return (
    <div className="space-y-10">
      <section>
        <SectionLabel>Exercise</SectionLabel>
        <h2 className="mt-2 text-[19px] font-semibold tracking-tight text-fg">{ex.title}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          <RichText text={ex.scenario} />
        </p>
      </section>

      {ex.setup && ex.setup.length > 0 && (
        <section>
          <SectionLabel>Setup</SectionLabel>
          <BulletList items={ex.setup} className="mt-3" />
        </section>
      )}

      <section>
        <SectionLabel>Steps</SectionLabel>
        <div className="mt-3">
          <NumberedList items={ex.steps} />
        </div>
      </section>

      {ex.starter && ex.starter.length > 0 && (
        <section>
          <SectionLabel>Starter code</SectionLabel>
          <div className="mt-3 space-y-4">
            {ex.starter.map((s, i) => (
              <CodeBlock key={i} snippet={s} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <SectionLabel>Expected behaviour</SectionLabel>
          <BulletList items={ex.expected} className="mt-3" />
        </div>
        <div>
          <SectionLabel>Verify it</SectionLabel>
          <BulletList items={ex.verification} className="mt-3" />
        </div>
      </section>

      <section>
        <SectionLabel>Hints</SectionLabel>
        <div className="mt-3 space-y-2">
          {ex.hints.map((h, i) => (
            <Disclosure
              key={i}
              summary={
                <span className="inline-flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-faint" aria-hidden /> Hint {i + 1}
                </span>
              }
            >
              <p className="text-[14px] leading-relaxed text-muted">
                <RichText text={h} />
              </p>
            </Disclosure>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>Success checklist</SectionLabel>
          <span className="font-mono text-[12px] text-faint">
            {lp.checklist.length}/{lesson.successChecklist.length}
          </span>
        </div>
        <div className="mt-2">
          {lesson.successChecklist.map((item, i) => (
            <CheckItem
              key={i}
              checked={lp.checklist.includes(i)}
              onChange={() => dispatch({ type: 'toggleListItem', slug: lesson.slug, field: 'checklist', index: i })}
            >
              <RichText text={item} />
            </CheckItem>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`notes-${lesson.slug}`}>
            <SectionLabel>Exercise notes</SectionLabel>
          </label>
          <SaveIndicator updatedAt={lp.exerciseNotes ? lp.updatedAt : undefined} />
        </div>
        <TextArea
          id={`notes-${lesson.slug}`}
          className="mt-3 min-h-[160px] font-mono text-[13px]"
          placeholder="Measurements, commands you ran, what surprised you, what you'd do differently…"
          value={lp.exerciseNotes}
          onChange={(e) => dispatch({ type: 'setText', slug: lesson.slug, field: 'exerciseNotes', value: e.target.value })}
        />
      </section>

      {lesson.stretch && (
        <section className="rounded-xl border border-dashed border-line p-5">
          <div className="flex items-center gap-2">
            <Mountain className="h-4 w-4 text-faint" aria-hidden />
            <SectionLabel>Optional stretch</SectionLabel>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold text-fg">{lesson.stretch.title}</h3>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            <RichText text={lesson.stretch.description} />
          </p>
        </section>
      )}

      {lesson.intensiveExtras.length > 0 && (
        <section>
          {mode === 'intensive' ? (
            <div className="rounded-xl border border-line bg-subtle/40 p-5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" aria-hidden />
                <SectionLabel>Intensive week · optional extra practice</SectionLabel>
              </div>
              <div className="mt-2">
                {lesson.intensiveExtras.map((x, i) => (
                  <CheckItem
                    key={i}
                    checked={lp.extras.includes(i)}
                    onChange={() => dispatch({ type: 'toggleListItem', slug: lesson.slug, field: 'extras', index: i })}
                  >
                    <RichText text={x} />
                  </CheckItem>
                ))}
              </div>
            </div>
          ) : (
            <Disclosure summary="Extra practice for intensive weeks (optional)">
              <BulletList items={lesson.intensiveExtras} />
            </Disclosure>
          )}
        </section>
      )}
    </div>
  );
}
