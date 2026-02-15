export type AnalyticsPayload = Record<string, string | number | boolean | undefined>;

export function trackEvent(event: string, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event, ...payload });
  }
  if (typeof w.gtag === 'function') {
    w.gtag('event', event, payload);
  }
}
