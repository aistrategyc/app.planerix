import React from 'react';
import type { LucideIcon } from 'lucide-react';

type Detail = { label: string; items: string[] };

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  details?: Detail[];
  items?: string[];
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function FeatureCard({ title, description, icon: Icon, details, items, className }: Props) {
  return (
    <div
      className={cx(
        'group flex h-full min-w-0 flex-col break-words rounded-[28px] border border-slate-200/70 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)]',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 text-white shadow-md transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
      {items && items.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-slate-600 break-words">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {details && details.length > 0 && (
        <div className="mt-5 space-y-4">
          {details.map((detail) => (
            <div key={detail.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.label}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700 break-words">
                {detail.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
