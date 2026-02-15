'use client';
// GDPR-compliant Cookie Consent Banner

import React, { useState, useEffect } from 'react';

export interface CookieConsentProps {
  onAccept: () => void;
  onDecline: () => void;
  className?: string;
}

const COOKIE_CONSENT_KEY = 'cookie-consent-v1';

export function useCookieConsent() {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      const consent = stored === 'accepted';
      setHasConsent(consent);
      setShowBanner(false);
    } else {
      setHasConsent(null);
      setShowBanner(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setHasConsent(true);
    setShowBanner(false);
  };

  const declineCookies = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
    setHasConsent(false);
    setShowBanner(false);
  };

  const resetConsent = () => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    setHasConsent(null);
    setShowBanner(true);
  };

  return {
    hasConsent,
    showBanner,
    acceptCookies,
    declineCookies,
    resetConsent,
    canUseCookies: hasConsent === true,
  };
}

export function CookieConsentBanner({ className = '' }: { className?: string }) {
  const { showBanner, acceptCookies, declineCookies } = useCookieConsent();

  if (!showBanner) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg p-4 ${className}`}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 mb-2">Cookie Notice</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            We use essential cookies to provide secure authentication and improve your experience. 
            These cookies are required for the application to function properly.{' '}
            <a 
              href="/privacy" 
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more about our privacy practices
            </a>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 min-w-max">
          <button
            onClick={declineCookies}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Essential Only
          </button>
          <button
            onClick={acceptCookies}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettings() {
  const { hasConsent, resetConsent } = useCookieConsent();
  
  if (hasConsent === null) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <h4 className="font-semibold text-slate-900 mb-2">Cookie Preferences</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-slate-900">Essential Cookies</span>
            <p className="text-sm text-slate-600">Required for authentication and security</p>
          </div>
          <span className="text-sm font-medium text-green-600">Always Active</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-slate-900">Current Status</span>
            <p className="text-sm text-slate-600">
              {hasConsent ? 'All cookies accepted' : 'Essential cookies only'}
            </p>
          </div>
          <button
            onClick={resetConsent}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Change Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Enhanced auth context hook that respects cookie consent
export function useAuthWithConsent() {
  const { canUseCookies } = useCookieConsent();
  
  return {
    canUseCookies,
    shouldUseCredentials: canUseCookies,
    authMode: canUseCookies ? 'full' : 'guest' as const,
  };
}
