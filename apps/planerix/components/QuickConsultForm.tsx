'use client';
import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { trackEvent } from '@/lib/analytics';

const schema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Enter a valid email'),
  country: z.string().min(2, 'Country is required'),
  source: z.string().optional(),
  referrer: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  website: z.string().max(0).optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  className?: string;
  onSuccess?: () => void;
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

export default function QuickConsultForm({ className, onSuccess }: Props) {
  const tracking = useMemo(collectTracking, []);
  const inputBase =
    'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 transition-colors';

  const [values, setValues] = useState<FormData>({
    name: '',
    email: '',
    country: '',
    website: '',
    ...tracking,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name as keyof FormData]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    trackEvent('SubmitConsultation', { source: values.source });

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof FormData] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    if (values.website && values.website.length > 0) {
      setStatus('success');
      setValues({ ...tracking, name: '', email: '', country: '', website: '' } as any);
      onSuccess?.();
      return;
    }

    try {
      setStatus('loading');
      const res = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed with ${res.status}`);
      }
      setStatus('success');
      setValues({ ...tracking, name: '', email: '', country: '', website: '' } as any);
      onSuccess?.();
    } catch (err: any) {
      setStatus('error');
      setServerError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={submit} className={cx('space-y-4', className)} noValidate>
      <div className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" value={values.website} onChange={handleChange} />
      </div>

      <div>
        <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          value={values.name}
          onChange={handleChange}
          className={cx(inputBase, errors.name ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200')}
          placeholder="Jane Doe"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={handleChange}
          className={cx(inputBase, errors.email ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200')}
          placeholder="jane@company.com"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="country" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Country</label>
        <input
          id="country"
          name="country"
          type="text"
          value={values.country}
          onChange={handleChange}
          className={cx(inputBase, errors.country ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200')}
          placeholder="United States"
        />
        {errors.country && <p className="mt-1 text-sm text-red-600">{errors.country}</p>}
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className={cx(
          'w-full rounded-full py-3 font-semibold transition-all duration-300',
          status === 'loading'
            ? 'bg-blue-200 text-slate-700 opacity-70 cursor-not-allowed'
            : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 text-white shadow-lg hover:translate-y-[-1px]'
        )}
        aria-busy={status === 'loading'}
      >
        {status === 'loading' ? 'Sending…' : 'Request consultation'}
      </button>

      <div aria-live="polite" className="min-h-[20px]">
        {status === 'success' && <p className="text-sm text-green-600">Thanks! We will reach out shortly.</p>}
        {status === 'error' && <p className="text-sm text-red-600">Unable to send. {serverError}</p>}
      </div>
    </form>
  );
}
