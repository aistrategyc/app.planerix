import React from 'react';

type Row = { label: string; value: string };

type Props = {
  title: string;
  badge?: string;
  rows: Row[];
  footer?: string;
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function UiPreviewCard({ title, badge, rows, footer, className }: Props) {
  return (
    <div
      className={cx(
        'rounded-[26px] border border-slate-200/70 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(15,23,42,0.12)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {badge && (
          <span className="rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-3 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4 space-y-2 text-xs text-slate-600">
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex items-start justify-between gap-3">
            <span className="text-slate-500">{row.label}</span>
            <span className="text-right font-semibold text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>
      {footer && (
        <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {footer}
        </div>
      )}
    </div>
  );
}
