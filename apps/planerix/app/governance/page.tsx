import { ShieldCheck, FileCheck, Sliders, RotateCcw, Users } from 'lucide-react';
import FeatureCard from '@/components/marketing/FeatureCard';
import CtaBand from '@/components/marketing/CtaBand';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const governanceHighlights = [
  'Approval flows for every action',
  'Run logs and audit trails by default',
  'Policies, rollback, and ownership',
];

const governanceSections = [
  {
    title: 'Approval flows',
    description: 'Define who approves what before execution.',
    icon: ShieldCheck,
    items: ['Role-based approvals', 'Escalation routing', 'SLA-based approvals'],
  },
  {
    title: 'Run logs',
    description: 'Every action is logged with evidence and outcomes.',
    icon: FileCheck,
    items: ['Audit trails', 'Evidence snapshots', 'Impact deltas'],
  },
  {
    title: 'Policies',
    description: 'Guardrails on what AI is allowed to do.',
    icon: Sliders,
    items: ['Policy tiers (notify/approve/auto-run)', 'Threshold rules', 'Exception handling'],
  },
  {
    title: 'Rollback / exceptions',
    description: 'Undo and control when results are not acceptable.',
    icon: RotateCcw,
    items: ['Rollback actions', 'Exception playbooks', 'Post-incident review'],
  },
  {
    title: 'Ownership & accountability',
    description: 'Every action has a human owner and accountability.',
    icon: Users,
    items: ['Owner assignment', 'Task accountability', 'Executive visibility'],
  },
];

const governanceNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'governance', label: 'Controls' },
  { id: 'consultation', label: 'Consultation' },
];

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Governance
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Governed AI execution</h1>
          <p className="mt-4 text-lg text-slate-600">
            Automation you can trust in production with approvals, policies, and audit trails.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Every action is traceable to evidence and measured by outcomes.
          </p>
          <Highlights items={governanceHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={governanceNav} />

      <section id="governance" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-8">
          {governanceSections.map((section) => (
            <FeatureCard
              key={section.title}
              title={section.title}
              description={section.description}
              icon={section.icon}
              items={section.items}
            />
          ))}
        </div>
      </section>

      <QuickConsultationSection />

      <CtaBand
        title="Governed automation for enterprise teams"
        text="Define ownership, approval flows, and audit requirements before execution goes live."
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
