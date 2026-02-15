import Link from 'next/link';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="pt-16 pb-20 px-6 bg-gradient-to-br from-blue-50 via-white to-blue-100">
        <div className="container mx-auto max-w-3xl text-center animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Thank you
          </span>
          <h1 className="mt-4 text-5xl font-bold text-slate-900">We received your request</h1>
          <p className="mt-4 text-lg text-slate-600">
            Our team will get back to you with the next steps and pilot outline.
          </p>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="container mx-auto grid lg:grid-cols-2 gap-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <h2 className="text-2xl font-bold text-slate-900">Download the 1-pager</h2>
            <p className="mt-3 text-sm text-slate-600">
              What is a data contour + pilot deliverables for executives.
            </p>
            <a
              href="/planerix-onepager.pdf"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Download 1-pager
            </a>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <h2 className="text-2xl font-bold text-slate-900">Watch the demo</h2>
            <p className="mt-3 text-sm text-slate-600">
              A short walkthrough of insights, approvals, and impact tracking.
            </p>
            <div className="mt-6 flex h-40 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                Play
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300"
          >
            Back to homepage
          </Link>
        </div>
      </section>
    </div>
  );
}
