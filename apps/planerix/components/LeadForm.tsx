'use client';
import React, { useState } from 'react';
import { z } from 'zod';

type LeadType = 'demo' | 'connection' | 'access' | 'other';
type Props = {
  type: LeadType;
  className?: string;
  onSuccess?: () => void;
  defaultPlan?: string;
};

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  company: z.string().min(2, 'Company is required'),
  phone: z.string().optional(),
  message: z.string().min(10, 'Please add a short context (10+ chars)'),
  plan: z.string().optional(),
  type: z.enum(['demo', 'connection', 'access', 'other']),
  website: z.string().max(0).optional(), // honeypot
  consent: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function LeadForm({ type, className, onSuccess, defaultPlan }: Props) {
  const [values, setValues] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
    plan: defaultPlan || '',
    type,
    website: '',
    consent: true,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string>('');

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type: t, checked } = e.target as any;
    setValues((v) => ({ ...v, [name]: t === 'checkbox' ? !!checked : value }));
    if (errors[name as keyof FormData]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      parsed.error.issues.forEach((i) => (fieldErrors[i.path[0] as keyof FormData] = i.message));
      setErrors(fieldErrors);
      return;
    }
    if (values.website) {
      setStatus('success'); // honeypot
      setValues({ ...values, name: '', email: '', company: '', phone: '', message: '', plan: '', website: '' });
      onSuccess?.();
      return;
    }
    try {
      setStatus('loading');
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          source: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
          referrer: typeof window !== 'undefined' ? document.referrer : undefined,
          utm_source: typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('utm_source') : undefined,
          utm_medium: typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('utm_medium') : undefined,
          utm_campaign: typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('utm_campaign') : undefined,
          utm_term: typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('utm_term') : undefined,
          utm_content: typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('utm_content') : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Request failed with ${res.status}`);
      }
      setStatus('success');
      setValues({ ...values, name: '', email: '', company: '', phone: '', message: '', plan: '' });
      onSuccess?.();
    } catch (err: any) {
      setStatus('error');
      setServerError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const title = {
    demo: 'Request a live demo',
    connection: 'Request connection/onboarding',
    access: 'Request access',
    other: 'Send a request',
  }[type];

  return (
    <form onSubmit={submit} className={cx('space-y-6', className)} noValidate>
      {/* Honeypot */}
      <div className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" value={values.website} onChange={handle} />
      </div>

      <h3 className="text-2xl font-bold">{title}</h3>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="name">Name</label>
          <input id="name" name="name" value={values.name} onChange={handle}
                 className={cx('w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2',
                   errors.name ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200')}
                 placeholder="John Smith" aria-invalid={!!errors.name}/>
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={values.email} onChange={handle}
                 className={cx('w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2',
                   errors.email ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200')}
                 placeholder="john@company.com" aria-invalid={!!errors.email}/>
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="company">Company</label>
          <input id="company" name="company" value={values.company} onChange={handle}
                 className={cx('w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2',
                   errors.company ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200')}
                 placeholder="Company name" aria-invalid={!!errors.company}/>
          {errors.company && <p className="mt-1 text-sm text-red-600">{errors.company}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="phone">Phone (optional)</label>
          <input id="phone" name="phone" value={values.phone} onChange={handle}
                 className="w-full px-4 py-3 border rounded-lg focus:outline-none border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                 placeholder="+48 123 456 789"/>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="plan">Plan (optional)</label>
          <select id="plan" name="plan" value={values.plan} onChange={handle}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
            <option value="">Select a plan</option>
            <option value="Starter">Starter</option>
            <option value="Team">Team</option>
            <option value="Premium">Premium</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="type">Request type</label>
          <input id="type" name="type" value={values.type} readOnly
                 className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"/>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" htmlFor="message">Message</label>
        <textarea id="message" name="message" value={values.message} onChange={handle}
                  className={cx('w-full px-4 py-3 border rounded-lg h-32 resize-none focus:outline-none focus:ring-2',
                    errors.message ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200')}
                  placeholder="Tell us about your use case or timeline…"/>
        {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" name="consent" checked={!!values.consent} onChange={handle}/>
        I agree to be contacted about this request.
      </label>

      <button type="submit" disabled={status === 'loading'}
              className={cx('w-full py-3 rounded-lg font-medium transition-all duration-300 transform',
                status === 'loading' ? 'bg-blue-300 text-gray-900 opacity-70 cursor-not-allowed'
                                     : 'bg-blue-600 text-white hover:shadow-xl hover:scale-[1.02]')}>
        {status === 'loading' ? 'Sending…' : 'Send request'}
      </button>

      <div aria-live="polite" className="min-h-[20px]">
        {status === 'success' && <p className="text-sm text-green-600">Thanks! We’ll get back to you shortly.</p>}
        {status === 'error' && <p className="text-sm text-red-600">Unable to send. {serverError}</p>}
      </div>
    </form>
  );
}