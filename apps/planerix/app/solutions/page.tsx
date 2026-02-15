import { Target, Network, BarChart3, Truck, Boxes, Settings, Headphones, Users, ShieldCheck, Handshake } from 'lucide-react';
import FeatureCard from '@/components/marketing/FeatureCard';
import CtaBand from '@/components/marketing/CtaBand';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const solutions = [
  {
    title: 'Marketing',
    description: 'Action packs for pacing, creative fatigue, and attribution control.',
    icon: Target,
    signals: ['Creative fatigue', 'Pacing drift', 'Query risk / attribution gaps'],
    actions: ['Creative refresh project', 'Budget shift request', 'Negative keyword task'],
    impacts: ['CPA', 'ROAS', 'Spend pace'],
    automation: 'If fatigue detected, then create creative refresh project (policy: approve).',
  },
  {
    title: 'Sales & RevOps',
    description: 'Pipeline discipline, SLA enforcement, and forecast stability.',
    icon: Network,
    signals: ['Lead aging risk', 'Stage stall > SLA', 'Forecast drift'],
    actions: ['Re-route leads + assign tasks', 'Escalate to managers', 'Weekly pipeline review pack'],
    impacts: ['Win rate', 'Sales cycle length', 'Forecast accuracy'],
    automation: 'If stage stall > SLA, then open escalation tasks (policy: approve).',
  },
  {
    title: 'Finance',
    description: 'Cashflow guardrails, OPEX policy, and margin anomalies.',
    icon: BarChart3,
    signals: ['Cash gap forecast', 'OPEX drift', 'Margin anomaly'],
    actions: ['Trigger approval workflow', 'Block spend + notify', 'Open variance review'],
    impacts: ['Runway stability', 'Variance reduction', 'Gross margin'],
    automation: 'If cash gap forecast, then trigger approvals (policy: approve).',
  },
  {
    title: 'Procurement',
    description: 'Supplier risk, price drift, and governed purchasing.',
    icon: Truck,
    signals: ['Supplier SLA risk', 'Price drift vs contract', 'Contract expiration window'],
    actions: ['Propose reorder plan', 'Request approval', 'Launch renegotiation tasks'],
    impacts: ['Cost stability', 'Reduced supply risk'],
    automation: 'If price drift > threshold, then create approval request (policy: approve).',
  },
  {
    title: 'Warehouse',
    description: 'Inventory availability and OOS prevention.',
    icon: Boxes,
    signals: ['OOS risk forecast', 'Slow-moving inventory', 'Receiving delays'],
    actions: ['Open restock plan', 'Trigger transfers', 'Escalate receiving issues'],
    impacts: ['Availability rate', 'Inventory turns'],
    automation: 'If OOS risk detected, then open restock plan (policy: notify).',
  },
  {
    title: 'Operations',
    description: 'Process compliance and variance detection.',
    icon: Settings,
    signals: ['Cycle time drift', 'Process compliance gaps', 'Quality incident spikes'],
    actions: ['Assign corrective tasks', 'Schedule root-cause review', 'Update SOP checklist'],
    impacts: ['Higher throughput', 'Lower defect rate'],
    automation: 'If compliance gap flagged, then create corrective tasks (policy: approve).',
  },
  {
    title: 'Support',
    description: 'Ticket triage and response automation.',
    icon: Headphones,
    signals: ['Backlog surge', 'SLA breach risk', 'Negative sentiment'],
    actions: ['Auto-triage and route', 'Escalate critical tickets', 'Generate response drafts'],
    impacts: ['Faster first response', 'Higher CSAT'],
    automation: 'If SLA breach risk, then escalate + assign tasks (policy: auto-run).',
  },
  {
    title: 'HR',
    description: 'Hiring SLA and retention signals.',
    icon: Users,
    signals: ['Open role aging', 'Attrition risk signals', 'Onboarding delays'],
    actions: ['Schedule interview blocks', 'Create retention plan tasks', 'Escalate onboarding issues'],
    impacts: ['Lower time-to-hire', 'Improved retention'],
    automation: 'If role aging > target, then schedule interview blocks (policy: approve).',
  },
  {
    title: 'Customer Success',
    description: 'Renewal risk detection and account health.',
    icon: Handshake,
    signals: ['Health score drop', 'Usage decline', 'Renewal risk window'],
    actions: ['Launch outreach playbook', 'Create success plan', 'Escalate renewal review'],
    impacts: ['Higher NRR', 'Lower churn'],
    automation: 'If health score drops, then open success plan (policy: approve).',
  },
  {
    title: 'IT & Security Ops',
    description: 'System uptime and policy enforcement.',
    icon: ShieldCheck,
    signals: ['Access anomalies', 'Uptime drift', 'Policy violations'],
    actions: ['Open incident ticket', 'Request privileged approval', 'Run remediation playbook'],
    impacts: ['Reduced downtime', 'Lower risk exposure'],
    automation: 'If policy violation detected, then open incident ticket (policy: notify).',
  },
];

const solutionsHighlights = [
  'Action packs = signals → delivered actions → impact metrics',
  'Governed execution with approvals and run logs',
  'Templates ready to reuse across teams',
];

const solutionsNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'solutions', label: 'Action packs' },
  { id: 'consultation', label: 'Consultation' },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Solutions
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Action packs for execution teams</h1>
          <p className="mt-4 text-lg text-slate-600">
            Each solution includes signals, delivered actions, and outcome metrics with governance.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Built on data contours with approvals, run logs, and audit trails.
          </p>
          <Highlights items={solutionsHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={solutionsNav} />

      <section id="solutions" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-8">
          {solutions.map((solution) => (
            <FeatureCard
              key={solution.title}
              title={solution.title}
              description={solution.description}
              icon={solution.icon}
              details={[
                { label: 'Signals', items: solution.signals },
                { label: 'Delivered actions', items: solution.actions },
                { label: 'Outcome metrics', items: solution.impacts },
                { label: 'Automation example', items: [solution.automation] },
              ]}
            />
          ))}
        </div>
      </section>

      <QuickConsultationSection />

      <CtaBand
        title="Ready to operationalize your workflows?"
        text="Pick a solution area, map your contour, and deploy execution agents with governance."
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
