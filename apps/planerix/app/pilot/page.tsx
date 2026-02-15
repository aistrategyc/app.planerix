import ContactForm from '@/components/ContactForm';
import UiPreviewCard from '@/components/marketing/UiPreviewCard';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const deliverables = [
  'Contour blueprint (sources, entities, rules)',
  '3-5 agents + policies',
  'Action delivery UI configured (owners, approvals)',
  'First templates created',
  'Impact dashboard baseline + weekly improvement plan',
];

const artifacts = [
  {
    title: 'Contour map',
    badge: 'Blueprint',
    rows: [
      { label: 'Entities', value: '12' },
      { label: 'Sources', value: '6' },
      { label: 'Owners', value: '4' },
    ],
    footer: 'Data contour blueprint and ownership map.',
  },
  {
    title: 'KPI semantic spec',
    badge: 'Spec',
    rows: [
      { label: 'KPIs', value: '18' },
      { label: 'Rules', value: '24' },
      { label: 'Version', value: 'v1.0' },
    ],
    footer: 'Definitions, formulas, and evidence references.',
  },
  {
    title: 'Action delivery UI',
    badge: 'Configured',
    rows: [
      { label: 'Owners', value: '7' },
      { label: 'Approvals', value: '3' },
      { label: 'Run logs', value: 'Enabled' },
    ],
    footer: 'Owners, approvals, and execution visibility.',
  },
  {
    title: 'Agent templates',
    badge: 'Library',
    rows: [
      { label: 'Agents', value: '5' },
      { label: 'Policies', value: '3' },
      { label: 'Versioning', value: 'Enabled' },
    ],
    footer: 'Reusable templates for the next contour.',
  },
  {
    title: 'Impact report',
    badge: 'Before/After',
    rows: [
      { label: 'KPI', value: 'Lead response' },
      { label: 'Delta', value: '-22%' },
      { label: 'Window', value: '30 days' },
    ],
    footer: 'Impact summary for exec review.',
  },
];

const successCriteria = [
  'Before/after KPI deltas measured',
  'Run logs and approvals for every automation',
  'Clear ownership for each action',
  'Repeatable template library for next rollout',
];

const pilotPackages = [
  {
    title: 'Fast ROI Pilot (6-8 weeks)',
    description: 'Foundation + 3-5 agents with impact baseline and governed automation.',
  },
  {
    title: 'Enterprise / Extended (8-12 weeks)',
    description: 'Multiple contours, advanced governance, private AI, and dedicated support.',
  },
];

const timeline = [
  {
    title: 'Weeks 1-2',
    description: 'Source discovery, contour map, and truth layer with KPI semantics.',
  },
  {
    title: 'Weeks 3-6',
    description: 'Deploy 3-5 agents, action delivery UI, and approval policies.',
  },
  {
    title: 'Weeks 7-8',
    description: 'Impact tracking, executive brief, and template library.',
  },
];

const pilotHighlights = [
  '6-12 week structured pilot with clear scope',
  '3-5 agents with governance policies',
  'Action delivery UI + impact tracking',
];

const pilotNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'criteria', label: 'Success criteria' },
  { id: 'packages', label: 'Packages' },
  { id: 'consultation', label: 'Consultation' },
];

export default function PilotPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Pilot and Design Partners
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Pilot program for measurable execution</h1>
          <p className="mt-4 text-lg text-slate-600">
            Start with a contour session and launch a governed pilot with clear outcomes.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Two packages: fast ROI in 6-8 weeks or enterprise scale in 8-12 weeks.
          </p>
          <Highlights items={pilotHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={pilotNav} />

      <section id="deliverables" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Deliverables</h2>
            <p className="mt-4 text-lg text-gray-600">
              Clear scope, proof, and execution plan across data, agents, and automation.
            </p>
            <ul className="mt-6 space-y-3 text-gray-700">
              {deliverables.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-8 shadow-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-slate-900">Book a contour session</h3>
            <p className="mt-2 text-sm text-slate-600">Share your sources and KPIs. We will map your first action pack.</p>
            <div className="mt-4">
              <ContactForm defaultType="pilot" redirectTo="/thank-you" />
            </div>
          </div>
        </div>
      </section>

      <section id="timeline" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900">Timeline</h2>
            <p className="mt-4 text-lg text-gray-600">Structured delivery with clear checkpoints.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {timeline.map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.title}</p>
                <p className="mt-3 text-sm text-gray-700">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="artifacts" className="py-20 px-6 bg-white scroll-mt-28">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900">What you get at the end</h2>
            <p className="mt-4 text-lg text-gray-600">Concrete artifacts that make the pilot tangible.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artifacts.map((item) => (
              <UiPreviewCard key={item.title} title={item.title} badge={item.badge} rows={item.rows} footer={item.footer} />
            ))}
          </div>
        </div>
      </section>

      <section id="criteria" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Success criteria</h2>
            <p className="mt-4 text-lg text-gray-600">
              We align on KPI impact, run logs, and repeatable templates before scaling.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm text-gray-700">
              {successCriteria.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="packages" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900">Pilot packages</h2>
            <p className="mt-4 text-lg text-gray-600">Choose the scope that fits your organization.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {pilotPackages.map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <QuickConsultationSection />
    </div>
  );
}
