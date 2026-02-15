import { ShieldCheck, Lock, Server, FileText, Cloud, Database } from 'lucide-react';
import Link from 'next/link';
import FeatureCard from '@/components/marketing/FeatureCard';
import ContactForm from '@/components/ContactForm';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const securityItems = [
  {
    title: 'Private AI and dedicated servers',
    description: 'Isolated environments for enterprise data contours.',
    icon: Server,
  },
  {
    title: 'Tenant isolation',
    description: 'Strong separation of data, agents, memory, and run logs.',
    icon: ShieldCheck,
  },
  {
    title: 'RBAC and audit',
    description: 'Role-based access control with full audit trails.',
    icon: Lock,
  },
  {
    title: 'Data retention policies',
    description: 'Configurable retention windows and export controls.',
    icon: FileText,
  },
  {
    title: 'On-prem or VPC deployment',
    description: 'Optional deployment in your infrastructure.',
    icon: Cloud,
  },
  {
    title: 'Memory governance',
    description: 'Classification, retention, and deletion controls for vector memory.',
    icon: Database,
  },
];

const securityFaq = [
  {
    q: 'Where is data stored and who can access it?',
    a: 'Data stays in your chosen region or private deployment. Access is limited via RBAC and audit logs.',
  },
  {
    q: 'How is tenant isolation handled?',
    a: 'Each tenant has isolated data, agents, and run logs with strict boundaries.',
  },
  {
    q: 'Do you log all actions and approvals?',
    a: 'Yes. Every automation run, approval, and change is written to audit logs.',
  },
];

const governanceItems = [
  'Approvals before sensitive actions',
  'Audit logs with evidence snapshots',
  'Policy checks and exception handling',
  'Rollback options for automated runs',
];

const residencyItems = [
  'Data residency by region or private deployment',
  'Private embeddings and private RAG memory',
  'Dedicated storage and encryption keys',
];

const memoryGovernance = [
  'Retention windows per contour and entity type',
  'Classification labels for cases and playbooks',
  'Deletion workflows with approval and audit trail',
  'Access scoped by RBAC and policy tiers',
];

const securityHighlights = [
  'Private deployments and tenant isolation',
  'RBAC with audit logs and approvals',
  'Memory governance and residency options',
];

const securityNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'controls', label: 'Controls' },
  { id: 'governance', label: 'Governance' },
  { id: 'memory', label: 'Memory' },
  { id: 'residency', label: 'Residency' },
  { id: 'faq', label: 'FAQ' },
  { id: 'consultation', label: 'Consultation' },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Security and Deployment
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Governance and deployment options</h1>
          <p className="mt-4 text-lg text-slate-600">
            Enterprise-grade security with flexible deployment models for private AI.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Built for regulated environments with auditability, isolation, and policy controls.
          </p>
          <Highlights items={securityHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={securityNav} />

      <section id="controls" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {securityItems.map((item) => (
            <FeatureCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
          ))}
        </div>
      </section>

      <section id="governance" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Governance and control</h2>
            <p className="mt-4 text-lg text-gray-600">
              Automation is governed by policy, approvals, and audit logs with rollback support.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm text-gray-700">
              {governanceItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="memory" className="py-20 px-6 bg-white scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Memory governance</h2>
            <p className="mt-4 text-lg text-gray-600">
              Control how vector memory is stored, classified, and deleted across your tenants.
            </p>
            <Link href="/memory" className="mt-4 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700">
              Learn more about memory &rarr;
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm text-gray-700">
              {memoryGovernance.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="residency" className="py-20 px-6 bg-white scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">Data residency and private memory</h2>
            <p className="mt-4 text-lg text-gray-600">
              Keep sensitive data in-region with private embeddings and isolated memory.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm text-gray-700">
              {residencyItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-bold text-gray-900">Security FAQ</h2>
            <p className="mt-4 text-lg text-gray-600">Short answers without legal jargon.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {securityFaq.map((item) => (
              <div key={item.q} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{item.q}</h3>
                <p className="mt-3 text-sm text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <QuickConsultationSection />

      <section className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Request a security review</h2>
            <p className="mt-4 text-lg text-gray-600">
              Share deployment requirements, compliance needs, and data isolation expectations.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-gray-700">
              {[
                'Private AI and dedicated infrastructure options',
                'Audit logging and approvals for every automation',
                'Data residency, retention, and deletion policies',
                'RBAC and tenant isolation',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
            <ContactForm defaultType="security" redirectTo="/thank-you" />
          </div>
        </div>
      </section>
    </div>
  );
}
