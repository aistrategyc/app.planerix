'use client';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

type Props = {
  title: string;
  text: string;
  eyebrow?: string;
  primaryLabel?: string;
  primaryHref?: string;
  primaryEvent?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  secondaryEvent?: string;
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function CtaBand({
  title,
  text,
  eyebrow = 'Next step',
  primaryLabel = 'Book a Contour Session',
  primaryHref = '/pilot',
  primaryEvent,
  secondaryLabel,
  secondaryHref = '/pilot',
  secondaryEvent,
  className,
}: Props) {
  return (
    <section className={cx('py-16 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100', className)}>
      <div className="container mx-auto">
        <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] animate-fade-up">
          <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-blue-200/60 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-indigo-200/50 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                {eyebrow}
              </span>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">{title}</h2>
              <p className="mt-3 text-lg text-slate-600">{text}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={primaryHref}
                onClick={() => primaryEvent && trackEvent(primaryEvent, { source: 'cta-band' })}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:translate-y-[-1px]"
              >
                {primaryLabel}
              </Link>
              {secondaryLabel && (
                <Link
                  href={secondaryHref}
                  onClick={() => secondaryEvent && trackEvent(secondaryEvent, { source: 'cta-band' })}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition-colors hover:border-blue-300"
                >
                  {secondaryLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
