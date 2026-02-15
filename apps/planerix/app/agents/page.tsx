import { ShieldCheck, Crown, Workflow, Layers, Wrench, Library } from 'lucide-react';
import AgentCard from '@/components/marketing/AgentCard';
import CtaBand from '@/components/marketing/CtaBand';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const agentGroups = [
  {
    id: 'control',
    title: 'Control Agents',
    description: 'Detect risks early, validate signals, and protect data integrity.',
    icon: ShieldCheck,
    items: [
      {
        title: 'Freshness & Quality',
        signal: 'Data pipelines drift or sources go stale.',
        action: 'Raise integrity incident with remediation steps.',
        impact: 'Fewer reporting errors and missed signals.',
        inputs: ['Pipelines', 'Schemas', 'SLA rules'],
        policy: 'Notify',
      },
      {
        title: 'Funnel & SLA',
        signal: 'Lead response time breaches SLA thresholds.',
        action: 'Escalate and assign owner tasks.',
        impact: 'Faster time-to-first-response.',
        inputs: ['CRM stages', 'SLA targets', 'Routing rules'],
        policy: 'Approve',
      },
      {
        title: 'Attribution Integrity',
        signal: 'Spend and revenue attribution mismatch.',
        action: 'Trigger reconciliation and alert finance.',
        impact: 'Trusted ROI reporting.',
        inputs: ['Ads', 'CRM', 'Analytics'],
        policy: 'Notify',
      },
      {
        title: 'Anomaly Watch',
        signal: 'KPI variance spikes beyond control limits.',
        action: 'Issue anomaly report with evidence links.',
        impact: 'Earlier risk detection.',
        inputs: ['KPI trends', 'Seasonality', 'Benchmarks'],
        policy: 'Notify',
      },
      {
        title: 'Budget Pacing',
        signal: 'Spend deviates from plan mid-cycle.',
        action: 'Recommend pacing adjustments and approvals.',
        impact: 'Stable ROAS and budget control.',
        inputs: ['Budgets', 'Spend', 'Forecasts'],
        policy: 'Approve',
      },
      {
        title: 'Creative Fatigue',
        signal: 'Creative performance decays below threshold.',
        action: 'Open creative refresh project with brief.',
        impact: 'Higher CTR and lower CAC.',
        inputs: ['Creative metrics', 'Pacing', 'Audience'],
        policy: 'Approve',
      },
    ],
  },
  {
    id: 'master',
    title: 'Master Agents',
    description: 'Turn signals into executive-ready decisions and plans.',
    icon: Crown,
    items: [
      {
        title: 'Executive Brief',
        signal: 'Weekly KPI pack requires synthesis.',
        action: 'Generate executive brief with priorities.',
        impact: 'Faster leadership alignment.',
        inputs: ['KPI packs', 'Run logs', 'Targets'],
        policy: 'Notify',
      },
      {
        title: 'Growth Planner',
        signal: 'Plateauing growth KPIs.',
        action: 'Prioritize experiments and owners.',
        impact: 'Higher experiment velocity.',
        inputs: ['Growth KPIs', 'Channel mix', 'Experiment history'],
        policy: 'Approve',
      },
      {
        title: 'RevOps Controller',
        signal: 'Pipeline velocity slows or stages stall.',
        action: 'Recommend routing changes and follow-up tasks.',
        impact: 'Improved win rate and velocity.',
        inputs: ['CRM', 'Deal stages', 'Routing rules'],
        policy: 'Approve',
      },
      {
        title: 'Finance Controller',
        signal: 'Cash gap or margin anomaly forecast.',
        action: 'Trigger guardrails and approvals.',
        impact: 'Reduced variance and cash risk.',
        inputs: ['P&L', 'Cashflow', 'Budget policy'],
        policy: 'Approve',
      },
    ],
  },
  {
    id: 'automators',
    title: 'Automators',
    description: 'Execute approved actions through tasks, workflows, and OKRs.',
    icon: Workflow,
    items: [
      {
        title: 'OKR Updater',
        signal: 'KPI deltas cross defined thresholds.',
        action: 'Update OKR status with evidence link.',
        impact: 'Accurate OKR reporting.',
        inputs: ['KPIs', 'OKR targets', 'Run logs'],
        policy: 'Notify',
      },
      {
        title: 'Meeting Builder',
        signal: 'Cross-team blockers persist > 7 days.',
        action: 'Schedule review meeting with agenda.',
        impact: 'Fewer stalled initiatives.',
        inputs: ['Task status', 'Owners', 'Calendars'],
        policy: 'Approve',
      },
      {
        title: 'Report Generator',
        signal: 'Weekly reporting window opens.',
        action: 'Generate and distribute KPI report.',
        impact: 'Consistent executive visibility.',
        inputs: ['Dashboards', 'KPI definitions', 'Recipients'],
        policy: 'Auto-run',
      },
      {
        title: 'Task Orchestrator',
        signal: 'Approved actions require execution chain.',
        action: 'Create task bundles and track completion.',
        impact: 'Shorter cycle time to action.',
        inputs: ['Approvals', 'Owners', 'Project rules'],
        policy: 'Auto-run',
      },
    ],
  },
];

const agentHighlights = [
  'Control, master, and automator layers',
  'Every agent tied to signal → action → impact',
  'Policies for notify, approve, and auto-run',
  'Template library with versioning and governance',
];

const templateFeatures = [
  {
    title: 'Canonical library',
    description: 'Ready-to-deploy templates for common teams and KPIs.',
  },
  {
    title: 'Customize per client contour',
    description: 'Adapt templates to entities, policies, and approval flows.',
  },
  {
    title: 'Versioning + evaluation',
    description: 'Track template performance with memory rules (RAG).',
  },
];

const builderSteps = [
  {
    title: 'Inputs',
    description: 'Select views, sources, and KPI definitions that feed the agent.',
  },
  {
    title: 'Rules',
    description: 'Set thresholds, anomalies, and playbooks for signal detection.',
  },
  {
    title: 'Actions',
    description: 'Define tasks, projects, and OKR updates the agent can deliver.',
  },
  {
    title: 'Governance',
    description: 'Approve or auto-run with clear ownership and audit trails.',
  },
  {
    title: 'Memory',
    description: 'Attach RAG sources, policies, and historical context.',
  },
];

const agentNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'control', label: 'Control agents' },
  { id: 'master', label: 'Master agents' },
  { id: 'automators', label: 'Automators' },
  { id: 'templates', label: 'Templates' },
  { id: 'builder', label: 'Builder' },
  { id: 'custom', label: 'Custom agents' },
  { id: 'consultation', label: 'Consultation' },
];

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            AI Agents Catalog
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Business-first agents that execute</h1>
          <p className="mt-4 text-lg text-slate-600">
            Each agent is tied to a signal, an action, and an impact metric with governed policies.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Standardize your most effective agents as templates and reuse them across teams.
          </p>
          <Highlights items={agentHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={agentNav} />

      {agentGroups.map((group) => (
        <section key={group.title} id={group.id} className="py-20 px-6 scroll-mt-28">
          <div className="container mx-auto">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white">
                <group.icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">{group.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{group.description}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.items.map((agent) => (
                <AgentCard
                  key={agent.title}
                  title={agent.title}
                  category={group.title}
                  signal={agent.signal}
                  action={agent.action}
                  impact={agent.impact}
                  inputs={agent.inputs}
                  policy={agent.policy}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section id="templates" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Agent Templates
            </span>
            <h2 className="mt-4 text-4xl font-bold text-gray-900">Ready-to-deploy templates for common teams and KPIs</h2>
            <p className="mt-4 text-lg text-gray-600">
              Build once, version, evaluate, and reuse across clients.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {templateFeatures.map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Library className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="builder" className="py-20 px-6 bg-white scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-gray-900">Build and standardize custom agents</h2>
                <p className="mt-2 text-sm text-gray-600">Then reuse them as templates across your org.</p>
              </div>
            </div>
            <p className="mt-6 text-lg text-gray-600">
              Even in MVP, Planerix exposes a clear configuration model for inputs, rules, actions, and governance.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Configurator flow</p>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              {builderSteps.map((step) => (
                <div key={step.title} className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                    {step.title[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="custom" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Personalized agents per client</h2>
            <p className="mt-4 text-lg text-gray-600">
              We build custom agents using your contour, memory, and rules so every action is specific to
              your business.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What we configure</p>
            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              {[
                'Contour-specific entities, KPIs, and ownership',
                'Vector memory with private embeddings',
                'Policy levels: notify, approve, auto-run',
                'Approvals, run logs, and audit trails',
              ].map((item) => (
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
        title="Deploy agents with governance"
        text="Define your contour, approval flow, and impact metrics before automation goes live."
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
