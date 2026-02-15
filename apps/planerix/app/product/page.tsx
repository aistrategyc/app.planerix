import { Layers, Target, ShieldCheck, Workflow, BarChart3, FileSearch, Database, Network } from 'lucide-react';
import FeatureCard from '@/components/marketing/FeatureCard';
import ProofStrip from '@/components/marketing/ProofStrip';
import CtaBand from '@/components/marketing/CtaBand';
import UiPreviewCard from '@/components/marketing/UiPreviewCard';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const productFeatures = [
  {
    title: 'Single truth layer',
    description: 'Entities, KPI semantics, and definitions you can govern.',
    icon: Layers,
  },
  {
    title: 'Metrics to work',
    description: 'Tasks, projects, and OKR updates tied to owners and deadlines.',
    icon: Target,
  },
  {
    title: 'Marketing and CRM analytics',
    description: 'Planning, funnel discipline, and attribution integrity.',
    icon: BarChart3,
  },
  {
    title: 'Governed automation',
    description: 'Approvals, logs, and policy checks for every action.',
    icon: ShieldCheck,
  },
  {
    title: 'Impact tracking',
    description: 'Before/after KPI deltas and executive briefs.',
    icon: FileSearch,
  },
];

const outputs = [
  {
    title: 'Insight',
    description: 'Signal with evidence and root-cause context.',
  },
  {
    title: 'Recommendation',
    description: 'Action plan with expected impact and dependencies.',
  },
  {
    title: 'Action',
    description: 'Task, project, or OKR update with assigned owners.',
  },
  {
    title: 'Run log entry',
    description: 'Audit trail with approvals and timestamps.',
  },
  {
    title: 'Impact report',
    description: 'Before/after KPI changes with narrative.',
  },
];

const outputPreviews = [
  {
    title: 'Insight card',
    badge: 'Signal',
    rows: [
      { label: 'Metric', value: 'Conversion drop' },
      { label: 'Delta', value: '-0.6pp' },
      { label: 'Evidence', value: 'GA4 + CRM' },
    ],
    footer: 'Root cause: creative fatigue in week 4.',
  },
  {
    title: 'Recommendation',
    badge: 'Expected impact',
    rows: [
      { label: 'Action', value: 'Creative refresh' },
      { label: 'Impact', value: '+0.4pp CVR' },
      { label: 'Owner', value: 'Marketing' },
    ],
    footer: 'Requires approval from Head of Marketing.',
  },
  {
    title: 'Action card',
    badge: 'Task',
    rows: [
      { label: 'Task', value: 'Launch new variants' },
      { label: 'Deadline', value: '72 hours' },
      { label: 'Owner', value: 'Creative Ops' },
    ],
    footer: 'Auto-created from fatigue signal.',
  },
  {
    title: 'Run log entry',
    badge: 'Audit',
    rows: [
      { label: 'Event', value: 'Approved run' },
      { label: 'Timestamp', value: '2026-01-18 10:14' },
      { label: 'Approver', value: 'COO' },
    ],
    footer: 'Logged with evidence snapshot.',
  },
  {
    title: 'Impact report',
    badge: 'Before/After',
    rows: [
      { label: 'KPI', value: 'CAC' },
      { label: 'Before', value: '$214' },
      { label: 'After', value: '$192' },
    ],
    footer: 'Measured across 30 days.',
  },
  {
    title: 'Executive brief',
    badge: 'Weekly',
    rows: [
      { label: 'Top risks', value: '3' },
      { label: 'Impact', value: '+$210k' },
      { label: 'Actions', value: '6 approved' },
    ],
    footer: 'Generated from truth layer and run logs.',
  },
];

const truthLayerDetails = [
  {
    title: 'KPI semantics',
    description: 'Formulas, filters, and attribution rules with versioning.',
  },
  {
    title: 'Ownership',
    description: 'Clear metric owners, approvals, and escalation paths.',
  },
  {
    title: 'Evidence references',
    description: 'Trace every metric to its source data and timestamp.',
  },
];

const automationPolicies = [
  {
    title: 'Notify',
    description: 'Agent surfaces a signal and suggests a task.',
  },
  {
    title: 'Approve',
    description: 'Owner review before running any automation.',
  },
  {
    title: 'Auto-run',
    description: 'Pre-approved workflows execute with logs and rollback.',
  },
];

const platformCapabilities = [
  {
    title: 'Contour Studio',
    description: 'Define sources, entities, ownership, and rules.',
    icon: Database,
  },
  {
    title: 'Semantic layer',
    description: 'KPI formulas, attribution logic, and SLA thresholds.',
    icon: Layers,
  },
  {
    title: 'Agent control plane',
    description: 'Deploy control and master agents with approvals.',
    icon: ShieldCheck,
  },
  {
    title: 'Automation engine',
    description: 'Workflows, tasks, and OKR updates tied to impact.',
    icon: Workflow,
  },
  {
    title: 'Impact analytics',
    description: 'Before and after KPI deltas with executive briefs.',
    icon: BarChart3,
  },
  {
    title: 'Integration fabric',
    description: 'Connect CRM, ads, finance, and ops systems.',
    icon: Network,
  },
];

const platformHighlights = [
  'Client-specific contours with semantic ownership',
  'Evidence-backed signals with run logs',
  'Approvals and governance before actions run',
  'Private AI and dedicated deployments available',
];

const productHighlights = [
  'Truth layer with KPI semantics and ownership',
  'Governed automation with approvals and audit trails',
  'Execution outputs your teams can act on immediately',
];

const productNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'platform', label: 'Platform' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'truth', label: 'Truth layer' },
  { id: 'automation', label: 'Automation' },
  { id: 'outputs', label: 'Outputs' },
  { id: 'consultation', label: 'Consultation' },
];

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Product overview
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">How Planerix executes from data to impact</h1>
          <p className="mt-4 text-lg text-slate-600">
            Build a truth layer, deploy AI agents, and automate execution with full governance.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Designed for enterprise leaders who need measurable KPI outcomes, not dashboards.
          </p>
          <Highlights items={productHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={productNav} />

      <section id="features" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold text-gray-900">What you get</h2>
            <p className="mt-4 text-lg text-gray-600">Everything needed to move from metrics to outcomes.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {productFeatures.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Platform capabilities</h2>
            <p className="mt-4 text-lg text-gray-600">
              Planerix is built as a control system for execution. The platform connects data contours,
              semantic KPIs, AI agents, and automation with full auditability.
            </p>
            <div className="mt-6 space-y-3 text-sm text-gray-700">
              {platformHighlights.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-gray-900" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {platformCapabilities.map((capability) => (
              <FeatureCard
                key={capability.title}
                title={capability.title}
                description={capability.description}
                icon={capability.icon}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="architecture" className="py-20 px-6 bg-white scroll-mt-28">
        <div className="container mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-bold text-gray-900">How it works</h2>
            <p className="mt-4 text-lg text-gray-600">A clear architecture you can audit and extend.</p>
          </div>
          <ProofStrip
            items={['Data', 'Semantics', 'Agents', 'Automation', 'UI']}
            className="justify-center"
          />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-700">
            {['Data', 'Semantics', 'Agents', 'Automation', 'UI'].map((item, index, arr) => (
              <div key={item} className="flex items-center gap-4">
                <span className="rounded-full border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-900">
                  {item}
                </span>
                {index < arr.length - 1 && <span className="text-gray-400">&rarr;</span>}
              </div>
            ))}
          </div>
          <div className="mt-10 grid md:grid-cols-5 gap-4">
            {[
              { title: 'Data', text: 'Sources, connectors, and ingestion' },
              { title: 'Semantics', text: 'Entities, KPI logic, ownership' },
              { title: 'Agents', text: 'Control and master agents' },
              { title: 'Automation', text: 'Tasks, approvals, workflows' },
              { title: 'UI', text: 'Dashboards, briefs, run logs' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 p-4 text-center">
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="mt-2 text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="truth" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Truth layer, built for accountability</h2>
            <p className="mt-4 text-lg text-gray-600">
              Every metric is defined, owned, and traceable to evidence so decisions are defensible.
            </p>
          </div>
          <div className="grid gap-6">
            {truthLayerDetails.map((detail) => (
              <div key={detail.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{detail.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{detail.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="automation" className="py-20 px-6 bg-white scroll-mt-28">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900">Automation policy</h2>
            <p className="mt-4 text-lg text-gray-600">Control how agents act, from notify to auto-run.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {automationPolicies.map((policy) => (
              <FeatureCard
                key={policy.title}
                title={policy.title}
                description={policy.description}
                icon={Workflow}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="outputs" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold text-gray-900">Visual proof: outputs and logs</h2>
            <p className="mt-4 text-lg text-gray-600">Realistic UI previews of what your team sees.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outputPreviews.map((preview) => (
              <UiPreviewCard
                key={preview.title}
                title={preview.title}
                badge={preview.badge}
                rows={preview.rows}
                footer={preview.footer}
              />
            ))}
          </div>
          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">60-sec product demo</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Video</span>
              </div>
              <div className="mt-6 flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 text-white">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                  Play
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                See insight cards, approvals, and automation runs in one flow.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Download 1-pager</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">PDF</span>
              </div>
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                What is a data contour + pilot deliverables for C-level stakeholders.
              </div>
              <a
                href="/planerix-onepager.pdf"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Download the 1-pager
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold text-gray-900">Outputs you can act on</h2>
            <p className="mt-4 text-lg text-gray-600">Every output is traceable and execution-ready.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outputs.map((item) => (
              <FeatureCard key={item.title} title={item.title} description={item.description} icon={Workflow} />
            ))}
          </div>
        </div>
      </section>

      <QuickConsultationSection />

      <CtaBand
        title="Start with a Contour Session"
        text="Map sources, KPIs, and automation in 30 minutes to define a pilot."
        primaryEvent="BookContour"
        secondaryLabel="Request a Pilot"
        secondaryEvent="RequestPilot"
      />
    </div>
  );
}
