import { Eye, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import { Button, CheckItem, Disclosure, RichText, SectionLabel, TextArea } from '@/components/ui';
import type { Lesson } from '@/data/types';
import { emptyLessonProgress } from '@/lib/progress';
import { useProgress } from '@/state/ProgressContext';
import { SaveIndicator } from './SaveIndicator';

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function ExplainStep({ lesson }: { lesson: Lesson }) {
  const { state, dispatch } = useProgress();
  const lp = state.lessons[lesson.slug] ?? emptyLessonProgress();
  const submitted = Boolean(lp.explanationSubmittedAt);
  const [revealAnyway, setRevealAnyway] = useState(false);
  const words = wordCount(lp.explanation);
  const id = `explain-${lesson.slug}`;

  return (
    <div className="space-y-10">
      <section>
        <SectionLabel>Explain it in your own words</SectionLabel>
        <div className="mt-3 flex gap-3 rounded-lg border border-line bg-subtle/50 p-4">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <label htmlFor={id} className="text-[15px] leading-relaxed text-fg">
            <RichText text={lesson.explainPrompt} />
          </label>
        </div>
        <TextArea
          id={id}
          className="mt-4 min-h-[240px]"
          placeholder="Write as if you were saying it out loud. Plain language, one concrete example, the trade-off."
          value={lp.explanation}
          onChange={(e) => dispatch({ type: 'setText', slug: lesson.slug, field: 'explanation', value: e.target.value })}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-faint">
            {words} word{words === 1 ? '' : 's'} · <SaveIndicator updatedAt={lp.explanation ? lp.updatedAt : undefined} />
          </span>
          {!submitted && (
            <Button
              variant="primary"
              size="sm"
              disabled={words < 20}
              onClick={() => dispatch({ type: 'submitExplanation', slug: lesson.slug })}
              title={words < 20 ? 'Write at least 20 words first' : undefined}
            >
              Submit and compare
            </Button>
          )}
        </div>
        <p className="mt-3 text-[12.5px] text-faint">
          Nothing here is graded automatically. You compare your explanation against the reference and criteria, honestly, yourself.
        </p>
      </section>

      {submitted || revealAnyway ? (
        <>
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel>Self-assessment</SectionLabel>
              <span className="font-mono text-[12px] text-faint">
                {lp.rubric.length}/{lesson.rubric.length}
              </span>
            </div>
            <p className="mt-2 text-[13.5px] text-muted">Tick only what your explanation actually does.</p>
            <div className="mt-2">
              {lesson.rubric.map((item, i) => (
                <CheckItem
                  key={i}
                  checked={lp.rubric.includes(i)}
                  onChange={() => dispatch({ type: 'toggleListItem', slug: lesson.slug, field: 'rubric', index: i })}
                >
                  <RichText text={item} />
                </CheckItem>
              ))}
            </div>
          </section>
          <section>
            <SectionLabel>Reference explanation</SectionLabel>
            <div className="mt-3 rounded-lg border border-line p-4 text-[14.5px] leading-[1.7] text-muted">
              {lesson.referenceExplanation.split(/\n\n+/).map((p, i) => (
                <p key={i} className={i ? 'mt-3' : undefined}>
                  <RichText text={p} />
                </p>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-dashed border-line p-5 text-center">
          <p className="text-[14px] text-muted">The reference explanation and self-assessment unlock after you submit your own.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRevealAnyway(true)}>
            <Eye className="h-3.5 w-3.5" aria-hidden /> Show anyway
          </Button>
        </section>
      )}

      <section>
        <SectionLabel>Comprehension check</SectionLabel>
        <p className="mt-2 text-[13.5px] text-muted">Answer each in your head or in your notes before revealing.</p>
        <ol className="mt-3 space-y-3">
          {lesson.questions.map((q, i) => (
            <li key={i}>
              <div className="mb-2 flex gap-3 text-[15px] font-medium leading-snug text-fg">
                <span className="font-mono text-[13px] text-faint">{i + 1}.</span>
                <span>
                  <RichText text={q.question} />
                </span>
              </div>
              <Disclosure summary="Reveal reference answer" className="ml-6">
                <p className="text-[14px] leading-relaxed text-muted">
                  <RichText text={q.answer} />
                </p>
              </Disclosure>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
