import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  country: z.string().min(2),
  source: z.string().optional(),
  referrer: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
});

const FROM = process.env.RESEND_FROM || 'Planerix <hello@planerix.com>';
const TO = (process.env.CONTACT_TO || 'kproleev@gmail.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const hits = new Map<string, { ts: number; count: number }>();
function ratelimit(ip: string, max = 15, windowMs = 60_000) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.ts > windowMs) {
    hits.set(ip, { ts: now, count: 1 });
    return true;
  }
  if (rec.count >= max) return false;
  rec.count += 1;
  return true;
}

function escapeHtml(str: string) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[m]!));
}

function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '0.0.0.0';
}

export async function POST(req: Request) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
  if (!RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Missing RESEND_API_KEY' }, { status: 500 });
  }

  let json: unknown;
  try { json = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const data = parsed.data;

  const ip = clientIp(req);
  if (!ratelimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const ua = req.headers.get('user-agent') || undefined;
  const referer = req.headers.get('referer') || data.referrer || undefined;

  const subject = `Consultation request — ${data.name} (${data.country})`;
  const utmLine = [
    data.utm_source && `utm_source=${escapeHtml(data.utm_source)}`,
    data.utm_medium && `utm_medium=${escapeHtml(data.utm_medium)}`,
    data.utm_campaign && `utm_campaign=${escapeHtml(data.utm_campaign)}`,
    data.utm_term && `utm_term=${escapeHtml(data.utm_term)}`,
    data.utm_content && `utm_content=${escapeHtml(data.utm_content)}`,
  ].filter(Boolean).join(' · ') || '—';

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
      <h2>${escapeHtml(subject)}</h2>
      <p><b>Name:</b> ${escapeHtml(data.name)}</p>
      <p><b>Email:</b> ${escapeHtml(data.email)}</p>
      <p><b>Country:</b> ${escapeHtml(data.country)}</p>
      <hr />
      <p><b>Source:</b> ${escapeHtml(data.source || 'unknown')}</p>
      ${referer ? `<p><b>Referrer:</b> ${escapeHtml(referer)}</p>` : ''}
      <p><b>UTM:</b> ${utmLine}</p>
      <p style="color:#666"><small>IP: ${escapeHtml(ip)} · UA: ${escapeHtml(ua || 'n/a')}</small></p>
    </div>
  `.trim();

  const text = [
    subject,
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Country: ${data.country}`,
    '',
    `Source: ${data.source || 'unknown'}`,
    `Referrer: ${referer || 'n/a'}`,
    `UTM: ${utmLine.replace(/<[^>]+>/g, '')}`,
    `IP: ${ip}`,
    `UA: ${ua || 'n/a'}`,
  ].filter(Boolean).join('\n');

  const resend = new Resend(RESEND_API_KEY);
  const { data: sent, error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject,
    replyTo: data.email,
    html,
    text,
    tags: [{ name: 'route', value: 'consultation' }],
  });

  if (error) {
    console.error('Resend error:', error);
    return NextResponse.json({ ok: false, error: 'Email delivery failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: sent?.id ?? null });
}
