import React from 'react';

type Item = {
  id: string;
  label: string;
};

type Props = {
  items: Item[];
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function PageNav({ items, className }: Props) {
  return (
    <div className={cx('sticky top-[72px] z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur', className)}>
      <div className="container mx-auto px-6">
        <nav className="flex items-center gap-2 overflow-x-auto py-3 text-sm font-medium text-slate-600">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-blue-300 hover:text-slate-900"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
