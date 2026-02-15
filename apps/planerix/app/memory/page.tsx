import Link from 'next/link';
import { BrainCircuit, BookOpen, FileText, History, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import CtaBand from '@/components/marketing/CtaBand';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const memoryCards = [
  {
    title: 'Cases & Decisions',
    description: 'Past decisions, what worked, what did not.',
    icon: BrainCircuit,
  },
  {
    title: 'Playbooks & Policies',
    description: 'Standard procedures and business rules.',
    icon: BookOpen,
  },
  {
    title: 'Documents & Context',
    description: 'Contracts, specs, and reference materials.',
    icon: FileText,
  },
  {
    title: 'Action History',
    description: 'Every run log and measurable outcome.',
    icon: History,
  },
];

const wowCases = [
  {
    title: 'Sales',
    description: 'Conversation warmth + next steps + discount guardrails.',
  },
  {
    title: 'Marketing',
    description: 'Creative fatigue signal + new brief + test plan.',
  },
  {
    title: 'Finance',
    description: 'Cash gap early warning + action plan.',
  },
  {
    title: 'Procurement',
    description: 'Supplier risk + reorder proposal + approvals.',
  },
  {
    title: 'Support',
    description: 'Triage + knowledge answers + task creation.',
  },
];

const decisionFlow = [
  'Signal detected with evidence and KPI context',
  'Similar cases retrieved with resolution history',
  'Recommendation drafted with approvals',
  'Action executed and impact logged',
];

const memoryHighlights = [
  'Cases, playbooks, docs, and run logs',
  'Similar-case retrieval for recommendations',
  'Governed memory retention by policy',
];

const memoryNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'flow', label: 'Decision flow' },
  { id: 'cases', label: 'Wow cases' },
  { id: 'consultation', label: 'Consultation' },
];

export default function MemoryPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
              <Sparkles className="h-4 w-4" />
              Vector Memory
            </span>
            <h1 className="mt-4 text-5xl font-bold text-slate-900">AI That Remembers Your Business</h1>
            <p className="mt-4 text-lg text-slate-600">
              Unlike generic AI, Planerix builds institutional intelligence from your history. Every case,
              decision, and outcome becomes context for smarter recommendations.
            </p>
            <Highlights items={memoryHighlights} className="mt-6" />
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {memoryCards.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 text-white">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/memory"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300"
            >
              Explore Memory
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative">
            <div className="absolute -top-6 -right-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-md">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                Connected<br />12 data sources
              </div>
            </div>
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <SearchIcon />
                </span>
                Memory-Powered Decision Flow
              </div>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Signal detected</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Lead engagement dropping for Enterprise</p>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Similar case found</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600">87% match</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Q3 2024: Resolved with personalized outreach</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Recommended action</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Launch targeted re-engagement campaign</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 px-4 py-1 text-xs font-semibold text-white">Approve</span>
                    <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs text-slate-600">Modify</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Run log created</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Full audit trail with impact tracking enabled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PageNav items={memoryNav} />

      <section id="flow" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900">Memory-powered decision flow</h2>
            <p className="mt-4 text-lg text-slate-600">Every recommendation is grounded in past outcomes.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {decisionFlow.map((item, index) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {index + 1}</p>
                <p className="mt-3 text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="cases" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900">Wow cases</h2>
            <p className="mt-4 text-lg text-slate-600">Real scenarios where memory accelerates action.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wowCases.map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <QuickConsultationSection />

      <CtaBand
        title="Bring memory into your execution loop"
        text="Turn cases, playbooks, and actions into reusable intelligence with governed AI."
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-4.2-4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
