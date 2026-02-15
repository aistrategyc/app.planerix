import { CheckSquare } from 'lucide-react';
import CtaBand from '@/components/marketing/CtaBand';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const outcomes = [
  {
    title: 'CPA ↓ after creative refresh',
    action: 'Action delivered: Creative refresh project + pacing fix',
    before: 'CPA 42',
    after: 'CPA 34',
  },
  {
    title: 'SLA response time ↓ after routing change',
    action: 'Action delivered: Routing change + escalation',
    before: 'FRT 4h',
    after: 'FRT 1.5h',
  },
  {
    title: 'Attribution coverage ↑ after tracking fixes',
    action: 'Action delivered: Tracking fixes + CRM mapping',
    before: 'Coverage 62%',
    after: 'Coverage 84%',
  },
  {
    title: 'Cash gap risk ↓ after finance guardrails',
    action: 'Action delivered: Finance guardrails + approval flow',
    before: 'Risk 18%',
    after: 'Risk 6%',
  },
];

const highlights = [
  'Before/after impact tracked per KPI',
  'Actions always tied to evidence',
  'Ownership and accountability built-in',
];

const outcomesNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'impact', label: 'Impact reports' },
  { id: 'consultation', label: 'Consultation' },
];

export default function OutcomesPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Outcomes
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Outcomes, not activity</h1>
          <p className="mt-4 text-lg text-slate-600">
            Planerix tracks impact before and after every action, aligned to KPIs and owners.
          </p>
          <Highlights items={highlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={outcomesNav} />

      <section id="impact" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid md:grid-cols-2 gap-6">
          {outcomes.map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">{item.action}</p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="rounded-full bg-slate-100 px-3 py-1">{item.before}</span>
                <span className="text-slate-400">→</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">{item.after}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <QuickConsultationSection />

      <CtaBand
        title="Measure outcomes with governed execution"
        text="Connect your sources, define KPI semantics, and launch a pilot with impact tracking."
        primaryLabel="Get a Demo"
        primaryHref="/contact"
        primaryEvent="BookContour"
        secondaryLabel="Start 6-8 Week Pilot"
        secondaryHref="/pilot"
        secondaryEvent="RequestPilot"
      />
    </div>
  );
}
