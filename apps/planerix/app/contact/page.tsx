import ContactForm from '@/components/ContactForm';
import PageNav from '@/components/marketing/PageNav';
import Highlights from '@/components/marketing/Highlights';
import QuickConsultationSection from '@/components/marketing/QuickConsultationSection';

const contactHighlights = [
  '30-minute contour session to map KPIs',
  'Pilot scope with timeline and deliverables',
  'Dedicated implementation support',
];

const contactNav = [
  { id: 'overview', label: 'Overview' },
  { id: 'request', label: 'Request' },
  { id: 'resources', label: 'Resources' },
  { id: 'consultation', label: 'Consultation' },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <section id="overview" className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100 scroll-mt-28">
        <div className="container mx-auto max-w-4xl animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Contact
          </span>
          <h1 className="mt-3 text-5xl font-bold text-slate-900">Talk to Planerix</h1>
          <p className="mt-4 text-lg text-slate-600">
            Share your contour, KPIs, and execution goals. We will respond with a pilot plan.
          </p>
          <Highlights items={contactHighlights} className="mt-6" />
        </div>
      </section>

      <PageNav items={contactNav} />

      <section id="request" className="py-20 px-6 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Request a contour session</h2>
            <p className="mt-4 text-lg text-gray-600">
              Tell us about your data sources, KPIs, and automation priorities.
            </p>
            <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">What to include</p>
              <ul className="mt-4 space-y-3 text-sm text-gray-700">
                {[
                  'Primary KPIs and ownership',
                  'Data sources and integrations',
                  'Approval workflow preferences',
                  'Timeline and pilot scope',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.1)]">
            <ContactForm defaultType="contour" redirectTo="/thank-you" />
          </div>
        </div>
      </section>

      <section id="resources" className="py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="container mx-auto grid lg:grid-cols-2 gap-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">60-sec demo</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Video</span>
            </div>
            <div className="mt-6 flex h-40 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                Play
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              A quick tour of insights, approvals, and automation runs.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Download 1-pager</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDF</span>
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              What is a data contour + pilot deliverables for C-level stakeholders.
            </div>
            <a
              href="/planerix-onepager.pdf"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Download the 1-pager
            </a>
          </div>
        </div>
      </section>

      <QuickConsultationSection />
    </div>
  );
}
