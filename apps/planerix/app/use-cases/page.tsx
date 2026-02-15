'use client';

import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import CtaBand from '@/components/marketing/CtaBand';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const categories = [
  { id: 'all', label: 'All' },
  { id: 'education', label: 'Education & EdTech' },
  { id: 'retail', label: 'Retail / Multi-location' },
  { id: 'ecommerce', label: 'E-commerce / DTC' },
  { id: 'b2b', label: 'B2B Sales / Lead Gen' },
  { id: 'services', label: 'Services' },
  { id: 'saas', label: 'SaaS / Subscription' },
];

const useCases = [
  {
    id: 'edu-1',
    category: 'education',
    title: 'Lead speed → enrollment growth',
    goal: 'Increase lead-to-contract conversion with SLA discipline.',
    signals: ['Lead aging', 'Response time', 'Stage drop-off'],
    actions: ['First-call tasks', 'Escalations', 'Weekly SLA plan'],
    impacts: ['Conversion rate', 'Time-to-first-contact', 'Contracts count'],
    ttv: '2-3 weeks',
  },
  {
    id: 'edu-2',
    category: 'education',
    title: 'Attribution integrity for budget decisions',
    goal: 'Understand which campaigns lead to contracts and payments.',
    signals: ['Spend→lead→contract coverage', 'Missing IDs/UTM', 'Offline leakage'],
    actions: ['Tracking fixes', 'Matching rules', 'CRM mapping tasks'],
    impacts: ['Matched revenue %', 'ROAS accuracy', 'Unattributed share'],
    ttv: '3-6 weeks',
  },
  {
    id: 'retail-1',
    category: 'retail',
    title: 'Store KPIs + inventory OOS risk',
    goal: 'Reduce out-of-stock and lost revenue.',
    signals: ['OOS patterns', 'Sell-through drops', 'Store anomalies'],
    actions: ['Restock tasks', 'Store manager alerts', 'SKU priorities'],
    impacts: ['OOS rate', 'Lost sales estimate', 'Revenue by store'],
    ttv: '2-4 weeks',
  },
  {
    id: 'retail-2',
    category: 'retail',
    title: 'Promo margin control',
    goal: 'Prevent margin erosion from promotions.',
    signals: ['Margin deviation', 'Discount anomalies', 'Vendor promo conflicts'],
    actions: ['Promo approval workflow', 'Promo exceptions report', 'Price correction tasks'],
    impacts: ['Gross margin', 'Promo ROI', 'Exceptions count'],
    ttv: '3-5 weeks',
  },
  {
    id: 'ecom-1',
    category: 'ecommerce',
    title: 'CAC & ROAS control with creative ops',
    goal: 'Maintain CAC/ROAS and accelerate creative refresh.',
    signals: ['Creative fatigue', 'CPA spikes', 'CTR drops'],
    actions: ['Creative refresh projects', 'Pacing rules', 'Approval workflow'],
    impacts: ['CAC/CPA', 'ROAS', 'Conversion rate'],
    ttv: '2-4 weeks',
  },
  {
    id: 'ecom-2',
    category: 'ecommerce',
    title: 'Customer support → churn prevention',
    goal: 'Reduce churn and refunds with early warnings.',
    signals: ['Negative tickets', 'Delayed responses', 'Refund spikes'],
    actions: ['Escalations', 'Root-cause tasks', 'Weekly churn brief'],
    impacts: ['Churn', 'Refund rate', 'CSAT/NPS'],
    ttv: '3-6 weeks',
  },
  {
    id: 'b2b-1',
    category: 'b2b',
    title: 'Pipeline discipline (RevOps)',
    goal: 'Predictable pipeline and sales plan execution.',
    signals: ['Stage stagnation', 'Deal aging', 'Activity gaps'],
    actions: ['Next-step tasks', 'Escalations', 'Weekly pipeline review pack'],
    impacts: ['Win rate', 'Sales cycle', 'Forecast accuracy'],
    ttv: '2-5 weeks',
  },
  {
    id: 'b2b-2',
    category: 'b2b',
    title: 'Marketing → Sales alignment',
    goal: 'Reduce MQL/SQL conflict and improve lead quality.',
    signals: ['Lead quality flags', 'Source mismatches', 'SLA breaches'],
    actions: ['Scoring corrections', 'Routing rules', 'Stop-list campaigns'],
    impacts: ['SQL rate', 'CPL→CAC', 'Meetings booked'],
    ttv: '3-6 weeks',
  },
  {
    id: 'services-1',
    category: 'services',
    title: 'Booking conversion + no-show reduction',
    goal: 'Increase bookings and reduce no-shows.',
    signals: ['Booking drop-offs', 'Slow follow-up', 'No-show patterns'],
    actions: ['Reminder workflows', 'Manager tasks', 'Schedule optimization'],
    impacts: ['Booking rate', 'No-show %', 'Revenue per slot'],
    ttv: '2-4 weeks',
  },
  {
    id: 'services-2',
    category: 'services',
    title: 'Unit economics & cashflow guardrails',
    goal: 'Control cash gaps and profitability.',
    signals: ['OPEX deviation', 'Cash runway risk', 'Margin drop'],
    actions: ['Expense approvals', 'Payment plan tasks', 'Cost center reports'],
    impacts: ['Cash balance forecast', 'OPEX vs plan', 'Gross margin'],
    ttv: '3-6 weeks',
  },
  {
    id: 'saas-1',
    category: 'saas',
    title: 'Trial-to-paid execution',
    goal: 'Increase activation and paid conversion.',
    signals: ['Activation drop-offs', 'Feature adoption gaps', 'Cohort anomalies'],
    actions: ['CS/sales playbook tasks', 'In-app nudges', 'Weekly brief'],
    impacts: ['Activation rate', 'Trial-to-paid', 'Churn'],
    ttv: '4-8 weeks',
  },
  {
    id: 'saas-2',
    category: 'saas',
    title: 'Customer health automation',
    goal: 'Detect churn risk early.',
    signals: ['Usage drops', 'Ticket spikes', 'Payment issues'],
    actions: ['Escalations', 'Retention tasks', 'Account plan updates'],
    impacts: ['Churn', 'NRR', 'Support load'],
    ttv: '4-8 weeks',
  },
];

const benefits = [
  'Fewer blind spots: data quality + integrity checks',
  'Faster execution: actions delivered with owners & deadlines',
  'Governed automation: approvals + run logs',
  'Measurable outcomes: impact tracked on KPI/OKR',
  'Reusable templates: client-specific agents become playbooks',
];

const highlights = [
  'Industry playbooks powered by your data contour',
  'Signals → delivered actions → impact metrics',
  'Time-to-value in 2-8 weeks',
];

const useCasesNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Use cases' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'consultation', label: 'Consultation' },
];

export default function UseCasesPage() {
  const [active, setActive] = useState('all');

  const filtered = useMemo(() => {
    if (active === 'all') return useCases;
    return useCases.filter((item) => item.category === active);
  }, [active]);

  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Use cases by industry
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Industry playbooks powered by your data contour</h1>
          <p className="mt-4 text-lg text-slate-600">
            Each use case maps signals to delivered actions and outcome metrics with governance.
          </p>
          <Highlights items={highlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={useCasesNav} />

      <section id="cases" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              <Filter className="h-4 w-4" />
              Filter by industry
            </div>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActive(cat.id)}
                className={`rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-colors max-w-full whitespace-normal text-center leading-tight ${
                  active === cat.id
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {filtered.map((item) => (
              <div key={item.id} className="min-w-0 break-words rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">Business goal: {item.goal}</p>
                <div className="mt-4 grid gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signals Planerix monitors</p>
                    <ul className="mt-2 space-y-1 text-gray-700 list-disc list-inside break-words">
                      {item.signals.map((signal) => (
                        <li key={signal}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actions delivered in Planerix UI</p>
                    <ul className="mt-2 space-y-1 text-gray-700 list-disc list-inside break-words">
                      {item.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Impact metrics</p>
                    <ul className="mt-2 space-y-1 text-gray-700 list-disc list-inside break-words">
                      {item.impacts.map((metric) => (
                        <li key={metric}>{metric}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Typical time-to-value: {item.ttv}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Benefits teams feel in the first 30 days</h2>
            <p className="mt-4 text-lg text-gray-600">Execution clarity, faster delivery, and measurable outcomes.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm text-gray-700">
              {benefits.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <QuickConsultationSection />

      <CtaBand
        title="Build your industry playbook"
        text="Share your contour and KPIs. We will deliver the first action pack and impact baseline."
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
