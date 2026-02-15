'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  primaryHref?: string;
  secondaryHref?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryEvent?: string;
  secondaryEvent?: string;
};

export default function HeroCtas({
  primaryHref = '/contact',
  secondaryHref = '/pilot',
  primaryLabel = 'Book Executive Demo',
  secondaryLabel = 'Start 6–8 Week Pilot',
  primaryEvent = 'BookContour',
  secondaryEvent = 'RequestPilot',
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Link
        href={primaryHref}
        onClick={() => trackEvent(primaryEvent, { source: 'home-hero' })}
        className="group inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 px-8 py-4 font-medium text-white shadow-lg transition-all duration-300 hover:translate-y-[-1px] hover:shadow-xl"
      >
        {primaryLabel}
        <ArrowRight className="ml-2 h-5 w-5" />
      </Link>
      <Link
        href={secondaryHref}
        onClick={() => trackEvent(secondaryEvent, { source: 'home-hero' })}
        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-4 font-medium text-slate-700 transition-colors hover:border-blue-400 hover:text-slate-900"
      >
        {secondaryLabel}
      </Link>
    </div>
  );
}
