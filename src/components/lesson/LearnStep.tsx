import { AlertTriangle, BookMarked, ExternalLink, FileText, GraduationCap, PlayCircle, Wrench, Dumbbell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, BulletList, CodeBlock, Paragraphs, RichText, SectionLabel } from '@/components/ui';
import type { Lesson, ResourceKind } from '@/data/types';
import { useProgress } from '@/state/ProgressContext';

const KIND_ICON: Record<ResourceKind, typeof FileText> = {
  docs: FileText,
  article: FileText,
  book: BookMarked,
  video: PlayCircle,
  course: GraduationCap,
  practice: Dumbbell,
  tool: Wrench,
};

export function LearnStep({ lesson }: { lesson: Lesson }) {
  const { lessons } = useProgress();
  const prereqLessons = (lesson.prerequisiteWeeks ?? [])
    .map((w) => lessons.find((l) => l.week === w))
    .filter((l): l is Lesson => Boolean(l));

  return (
    <div className="space-y-10">
      <section>
        <SectionLabel>Why it matters in production</SectionLabel>
        <p className="mt-3 rounded-lg border-l-2 border-accent/60 bg-accent/[0.04] py-2 pl-4 pr-3 text-[15px] leading-relaxed text-fg">
          <RichText text={lesson.whyItMatters} />
        </p>
      </section>

      <section>
        <SectionLabel>The idea, in plain English</SectionLabel>
        <Paragraphs items={lesson.explanation} className="mt-3" />
      </section>

      {lesson.examples && lesson.examples.length > 0 && (
        <section>
          <SectionLabel>Examples</SectionLabel>
          <div className="mt-3 space-y-4">
            {lesson.examples.map((ex, i) => (
              <CodeBlock key={i} snippet={ex} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Key takeaways</SectionLabel>
        <BulletList items={lesson.keyTakeaways} className="mt-3" />
      </section>

      <section>
        <SectionLabel>Resources</SectionLabel>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {lesson.resources.map((r) => {
            const Icon = KIND_ICON[r.kind];
            return (
              <li key={r.url + r.title}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex gap-3 px-4 py-3 transition-colors hover:bg-subtle/60"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[14.5px] font-medium text-fg group-hover:underline group-hover:decoration-faint group-hover:underline-offset-2">
                        {r.title}
                      </span>
                      <Badge className="capitalize">{r.kind}</Badge>
                      {r.minutes ? <span className="text-[12px] text-faint">{r.minutes} min</span> : null}
                      {r.verify && (
                        <Badge tone="warn" className="gap-1">
                          <AlertTriangle className="h-3 w-3" aria-hidden /> Verify link/edition
                        </Badge>
                      )}
                    </span>
                    {r.note && (
                      <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
                        <RichText text={r.note} />
                      </span>
                    )}
                    <span className="mt-1 block truncate font-mono text-[11.5px] text-faint">{r.url.replace(/^https?:\/\//, '')}</span>
                  </span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[12px] text-faint">
          Links marked “verify” point at books, paid content, or deep links that may move. Check the edition or section before relying
          on it.
        </p>
      </section>

      <section>
        <SectionLabel>Prerequisites</SectionLabel>
        <BulletList items={lesson.prerequisites} className="mt-3" />
        {prereqLessons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {prereqLessons.map((l) => (
              <Link
                key={l.slug}
                to={`/lesson/${l.slug}/learn`}
                className="rounded-md border border-line px-2 py-1 text-[12.5px] text-muted transition-colors hover:bg-subtle hover:text-fg"
              >
                W{l.week} · {l.title}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
