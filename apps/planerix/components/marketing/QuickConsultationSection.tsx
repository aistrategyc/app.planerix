import Link from 'next/link';
import { Globe2, ArrowRight, Sparkles } from 'lucide-react';
import QuickConsultForm from '@/components/QuickConsultForm';

const defaultHighlights = [
  'Short discovery call within 1 business day',
  'Review your KPIs, data sources, and workflow goals',
  'Receive a pilot outline with timing and scope',
];

type Props = {
  id?: string;
  title?: string;
  description?: string;
  highlights?: string[];
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function QuickConsultationSection({
  id = 'consultation',
  title = 'Request a fast consultation',
  description = 'Share your name, email, and country to schedule a quick planning call.',
  highlights = defaultHighlights,
  className,
}: Props) {
  return (
    <section id={id} className={cx('py-20 px-6 bg-white scroll-mt-28', className)}>
      <div className="container mx-auto">
        <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] animate-gradient">
          <div className="absolute -top-20 -right-12 h-56 w-56 rounded-full bg-blue-200/60 blur-3xl animate-float-slow" />
          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-indigo-200/60 blur-3xl animate-float-slow" />
          <div className="relative grid lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                <Sparkles className="h-4 w-4" />
                Quick consultation
              </span>
              <h2 className="text-4xl font-bold text-slate-900">{title}</h2>
              <p className="text-lg text-slate-600">{description}</p>
              <ul className="space-y-3 text-sm text-slate-700">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
                  <Globe2 className="h-4 w-4 text-blue-600" />
                  Global teams welcome
                </span>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:border-blue-300"
                >
                  Full request form
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.1)]">
              <QuickConsultForm />
              <p className="mt-4 text-xs text-slate-500">
                By submitting, you agree that we may contact you about Planerix services.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
