import { Plug, Layers, ShieldCheck, Workflow, Waypoints } from 'lucide-react';
import FeatureCard from '@/components/marketing/FeatureCard';
import CtaBand from '@/components/marketing/CtaBand';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const integrationHighlights = [
  'Native connectors + any DB/API via ETL',
  'Delivery channels for actions and approvals',
  'Governed sync with audit trails',
];

const integrationBlocks = [
  {
    title: 'Native connectors',
    items: ['CRM', 'Meta', 'Google Ads', 'GA4'],
  },
  {
    title: 'Any DB/API via ETL',
    items: ['SQL / data warehouses', 'Custom REST APIs', 'S3 / files'],
  },
  {
    title: 'Delivery channels',
    items: ['Email', 'Slack', 'Telegram', 'Jira/Asana', 'Webhooks'],
  },
  {
    title: 'Finance',
    items: ['Banks', 'Payments', 'ERP', 'POS'],
  },
  {
    title: 'Retail / Inventory',
    items: ['Inventory', 'Store systems', 'POS feeds'],
  },
];

const integrationApproach = [
  'Discovery and source inventory',
  'Entity mapping and KPI definitions',
  'Sync and normalization',
  'Quality assurance and ownership',
  'Monitoring and run logs',
];

const contourItems = [
  'We build a governed data + process contour, not just ETL.',
  'Entities, ownership, and rules are defined upfront.',
  'Every signal and action has evidence and audit trail.',
];

const securityNotes = [
  'Least-privilege access for every connector',
  'Audit logs for sync and automation events',
  'Tenant isolation and private deployment options',
];

const integrationNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'sources', label: 'Sources' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'approach', label: 'Approach' },
  { id: 'contours', label: 'Contours' },
  { id: 'consultation', label: 'Consultation' },
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Integrations
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Connect every system that drives execution</h1>
          <p className="mt-4 text-lg text-slate-600">
            We connect across your stack to build a trusted contour for signals, actions, and impact.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Integrations are tailored per client with ownership, governance, and audit trails.
          </p>
          <Highlights items={integrationHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={integrationNav} />

      <section id="sources" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Data sources</h2>
            <p className="mt-4 text-lg text-gray-600">A clear list of what we connect.</p>
          </div>
          <div className="grid gap-4">
            {integrationBlocks.map((block) => (
              <div key={block.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{block.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {block.items.map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="delivery" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Delivery channels</h2>
            <p className="mt-4 text-lg text-gray-600">
              Actions can be delivered through messaging, project tools, or automated workflows.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm text-gray-700">
              {['Email', 'Slack', 'Telegram', 'Jira/Asana', 'Webhooks'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="approach" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            title="Integration approach"
            description="Discovery to ownership with clear QA checkpoints."
            icon={Workflow}
            items={integrationApproach}
          />
          <FeatureCard
            title="Contour building"
            description="Governed data + process contour for execution."
            icon={Layers}
            items={contourItems}
          />
          <FeatureCard
            title="Security-first"
            description="Least privilege, audit, and isolation by default."
            icon={ShieldCheck}
            items={securityNotes}
          />
        </div>
      </section>

      <section id="contours" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Why contours matter</h2>
            <p className="mt-4 text-lg text-gray-600">
              The contour defines truth, ownership, and execution rules so agents can act safely.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Plug className="h-5 w-5" />
              </div>
              <p className="text-sm text-gray-700">
                Integrations are mapped to entities, KPI semantics, and approval rules before automation goes live.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
              <Waypoints className="h-4 w-4 text-blue-600" />
              <span>Every signal links back to evidence and ownership.</span>
            </div>
          </div>
        </div>
      </section>

      <QuickConsultationSection />

      <CtaBand
        title="Connect your systems with governance"
        text="Map sources, entities, and policies before agents start executing."
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
