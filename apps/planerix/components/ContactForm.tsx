'use client';
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { trackEvent } from '@/lib/analytics';

const schema = z.object({
  name: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Enter a valid email'),
  company: z.string().min(2, 'Company is required'),
  message: z.string().min(10, 'Tell us a bit more (10+ chars)'),
  phone: z.string().optional(),
  plan: z.string().optional(),
  type: z.enum(['contour', 'pilot', 'security', 'demo', 'connection', 'access', 'other']).default('contour'),
  // системные поля
  source: z.string().optional(),
  referrer: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  // honeypot
  website: z.string().max(0).optional(),
});

type FormData = z.infer<typeof schema>;
type ContactType = FormData['type'];
type Props = {
  className?: string;
  onSuccess?: () => void;
  defaultType?: ContactType;
  redirectTo?: string;
};
function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

function collectTracking() {
  if (typeof window === 'undefined') return {};
  const url = new URL(window.location.href);
  const sp = url.searchParams;
  return {
    source: url.pathname,
    referrer: document.referrer || undefined,
    utm_source: sp.get('utm_source') || undefined,
    utm_medium: sp.get('utm_medium') || undefined,
    utm_campaign: sp.get('utm_campaign') || undefined,
    utm_term: sp.get('utm_term') || undefined,
    utm_content: sp.get('utm_content') || undefined,
  };
}

export default function ContactForm({ className, onSuccess, defaultType = 'contour', redirectTo }: Props) {
  const router = useRouter();
  const tracking = useMemo(collectTracking, []);
  const inputBase =
    'w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 transition-colors';
  const selectBase =
    'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 transition-colors';
  const [values, setValues] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    message: '',
    phone: '',
    plan: '',
    type: defaultType,
    website: '', // honeypot
    ...tracking,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name as keyof FormData]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    trackEvent('SubmitForm', {
      type: values.type,
      source: values.source,
    });
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof FormData] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    if (values.website && values.website.length > 0) {
      setStatus('success'); // бот — делаем вид, что всё ОК
      trackEvent('SubmitForm', {
        status: 'success',
        type: values.type,
        source: values.source,
      });
      setValues({ ...tracking, name: '', email: '', company: '', message: '', phone: '', plan: '', type: defaultType, website: '' } as any);
      onSuccess?.();
      if (redirectTo) router.push(redirectTo);
      return;
    }

    try {
      setStatus('loading');
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed with ${res.status}`);
      }
      setStatus('success');
      trackEvent('SubmitForm', {
        status: 'success',
        type: values.type,
        source: values.source,
      });
      setValues({ ...tracking, name: '', email: '', company: '', message: '', phone: '', plan: '', type: defaultType, website: '' } as any);
      onSuccess?.();
      if (redirectTo) router.push(redirectTo);
    } catch (err: any) {
      setStatus('error');
      setServerError(err?.message || 'Something went wrong. Please try again.');
      trackEvent('SubmitForm', {
        status: 'error',
        type: values.type,
        source: values.source,
      });
    }
  };

  return (
    <form onSubmit={submit} className={cx('space-y-6', className)} noValidate>
      {/* Honeypot */}
      <div className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" value={values.website} onChange={handleChange} />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Request type</label>
        <select
          name="type"
          value={values.type}
          onChange={handleChange}
          className={cx(selectBase, errors.type ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200')}
        >
          <option value="contour">Contour Session</option>
          <option value="pilot">Pilot (8-12 weeks)</option>
          <option value="security">Security / Deployment</option>
          <option value="demo">Demo</option>
          <option value="other">Other</option>
        </select>
        {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type}</p>}
      </div>

      <div>
        <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Name</label>
        <input id="name" name="name" type="text" value={values.name} onChange={handleChange}
          className={cx(inputBase, errors.name ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200')} />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Email</label>
        <input id="email" name="email" type="email" value={values.email} onChange={handleChange}
          className={cx(inputBase, errors.email ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200')} />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="company" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Company</label>
        <input id="company" name="company" type="text" value={values.company} onChange={handleChange}
          className={cx(inputBase, errors.company ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200')} />
        {errors.company && <p className="mt-1 text-sm text-red-600">{errors.company}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Phone (optional)</label>
        <input id="phone" name="phone" type="tel" value={values.phone || ''} onChange={handleChange}
          className={cx(inputBase, 'border-slate-200 focus:ring-blue-200')} />
      </div>

      <div>
        <label htmlFor="plan" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Scope (optional)</label>
        <input id="plan" name="plan" type="text" value={values.plan || ''} onChange={handleChange}
          placeholder="Team size, timeline, or budget"
          className={cx(inputBase, 'border-slate-200 focus:ring-blue-200')} />
      </div>

      <div>
        <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Message</label>
        <textarea id="message" name="message" value={values.message} onChange={handleChange}
          className={cx(
            inputBase,
            'h-32 resize-none',
            errors.message ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
          )} />
        {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className={cx(
          'w-full rounded-full py-3 font-medium transition-all duration-300',
          status === 'loading'
            ? 'bg-blue-200 text-slate-700 opacity-70 cursor-not-allowed'
            : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 text-white shadow-lg hover:translate-y-[-1px]'
        )}
        aria-busy={status === 'loading'}
      >
        {status === 'loading' ? 'Sending…' : 'Send message'}
      </button>

      <div aria-live="polite" className="min-h-[20px]">
        {status === 'success' && <p className="text-sm text-green-600">Thanks! We’ll get back to you shortly.</p>}
        {status === 'error' && <p className="text-sm text-red-600">Unable to send your message. {serverError}</p>}
      </div>
    </form>
  );
}
