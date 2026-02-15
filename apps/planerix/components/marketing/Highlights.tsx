import { CheckCircle2 } from 'lucide-react';

type Props = {
  items: string[];
  className?: string;
};

function cx(...args: Array<string | undefined | false>) {
  return args.filter(Boolean).join(' ');
}

export default function Highlights({ items, className }: Props) {
  return (
    <div className={cx('grid gap-3 sm:grid-cols-2 text-sm text-slate-600', className)}>
      {items.map((item) => (
        <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}
