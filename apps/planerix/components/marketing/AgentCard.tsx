import React from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  category?: string;
  signal: string;
  action: string;
  impact: string;
  inputs: string[];
  policy: string;
  icon?: LucideIcon;
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function AgentCard({
  title,
  category,
  signal,
  action,
  impact,
  inputs,
  policy,
  icon: Icon,
  className,
}: Props) {
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
      {category && (
        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {category}
        </span>
      )}
      <h3 className="mt-3 text-xl font-semibold text-slate-900">{title}</h3>
      <div className="mt-5 space-y-3 text-sm text-slate-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signal</p>
          <p className="mt-1">{signal}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</p>
          <p className="mt-1">{action}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Impact metric</p>
          <p className="mt-1">{impact}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data inputs</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {inputs.map((item) => (
              <span key={item} className="max-w-full break-words rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Policy</p>
          <p className="mt-1 font-semibold text-slate-900">{policy}</p>
        </div>
      </div>
    </div>
  );
}
