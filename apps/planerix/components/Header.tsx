'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/ai-agents', label: 'AI Agents' },
  { href: '/memory', label: 'Memory' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/outcomes', label: 'Outcomes' },
  { href: '/pilot', label: 'Pilot' },
  { href: '/governance', label: 'Governance' },
  { href: '/security', label: 'Security' },
  { href: '/contact', label: 'Contact' },
];

const NAV_GROUPS = [
  {
    label: 'Platform',
    items: [
      { href: '/product', label: 'Product' },
      { href: '/ai-agents', label: 'AI Agents' },
      { href: '/memory', label: 'Memory' },
      { href: '/outcomes', label: 'Outcomes' },
    ],
  },
  {
    label: 'Execution',
    items: [
      { href: '/solutions', label: 'Solutions' },
      { href: '/use-cases', label: 'Use Cases' },
      { href: '/integrations', label: 'Integrations' },
    ],
  },
  {
    label: 'Company',
    items: [
      { href: '/pilot', label: 'Pilot' },
      { href: '/governance', label: 'Governance' },
      { href: '/security', label: 'Security' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://app.planerix.com';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const loginUrl = `${APP_ORIGIN}/login`;
  const registerUrl = `${APP_ORIGIN}/register`;
  const consultHref = `${pathname || '/'}#consultation`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/70' : 'bg-white/80 backdrop-blur-sm'
      }`}
    >
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center space-x-3">
            <Image src="/planerixlogoicon.png" alt="Planerix" width={36} height={36} className="h-9 w-9 rounded-lg shadow-sm" priority />
            <span className="text-2xl font-bold text-slate-900">Planerix</span>
          </Link>

          <div className="hidden lg:flex flex-1 items-center justify-center space-x-8 text-sm font-medium text-slate-600">
            {NAV.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`transition-colors ${
                  pathname === i.href ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {i.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center space-x-4">
            <Link
              href={loginUrl}
              prefetch={false}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href={registerUrl}
              prefetch={false}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Register
            </Link>
            <Link
              href="/contact"
              onClick={() => trackEvent('BookContour', { source: 'header' })}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 px-6 py-2 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:translate-y-[-1px]"
            >
              Get a Demo
            </Link>
          </div>

          <button
            className="lg:hidden text-slate-600"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="lg:hidden">
          <button
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="fixed top-[72px] left-0 right-0 z-50 max-h-[calc(100vh-72px)] overflow-y-auto border-t border-slate-200 bg-white shadow-lg">
            <div className="px-6 py-6 space-y-6">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
                  <div className="grid gap-2">
                    {group.items.map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        {i.label}
                        <span className="text-slate-400">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Quick navigation</p>
                <p className="mt-1 text-xs text-slate-500">Jump to the consultation block on this page.</p>
                <Link
                  href={consultHref}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Go to consultation
                </Link>
              </div>
              <div className="grid gap-3">
                <Link href={loginUrl} prefetch={false} className="text-sm font-medium text-slate-600">
                  Login
                </Link>
                <Link href={registerUrl} prefetch={false} className="text-sm font-medium text-slate-600">
                  Register
                </Link>
                <Link
                  href="/contact"
                  onClick={() => trackEvent('BookContour', { source: 'header-mobile' })}
                  className="block text-center bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 text-white px-6 py-3 rounded-full transition-all duration-300"
                >
                  Get a Demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
