import React from 'react';

type Props = {
  items: string[];
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function ProofStrip({ items, className }: Props) {
  return (
    <div className={cx('flex flex-wrap items-center gap-3', className)}>
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm"
        >
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" />
          {item}
        </span>
      ))}
    </div>
  );
}
