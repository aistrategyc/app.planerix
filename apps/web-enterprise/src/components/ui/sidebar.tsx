'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  Home,
  Target,
  ListChecks,
  BarChart,
  Users,
  PieChart,
  Calendar,
  BrainCircuit,
  FolderKanban,
  LineChart,
  Megaphone,
  FileText,
  Database,
  Share2,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
};

const MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/okr', label: 'OKR', icon: Target },
  { href: '/crm', label: 'CRM', icon: BarChart },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/ads', label: 'Ads', icon: Megaphone },
  { href: '/marketing', label: 'Marketing', icon: LineChart },
  { href: '/contracts-analytics', label: 'Contracts', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: PieChart },
  { href: '/attribution', label: 'Attribution', icon: Share2 },
  { href: '/data-analytics', label: 'Data Analytics', icon: Database },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/ai', label: 'AI', icon: BrainCircuit },
];

const FOOTER: NavItem[] = [];

type SidebarProps = {
  isMobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ isMobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  // активность роутинга
  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));

  // ширина и паддинги панелей
  const wide = isHovered || isMobileOpen;
  const asideWidth = wide ? 'w-64 px-3 md:px-4' : 'w-[56px] px-2';
  const align = wide ? 'items-start' : 'items-center';

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity md:hidden',
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={[
          // сдвигаем ниже фиксированного хедера (~64px)
          'fixed left-0 z-40 h-[calc(100vh-72px)] top-[72px]',
          'border-r border-border glass-panel shadow-sm',
          'transition-all duration-300 ease-out',
          'flex flex-col overflow-hidden',
          'transform md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          asideWidth,
        ].join(' ')}
        aria-label="Primary navigation"
      >
      {/* Основная навигация */}
      <nav className={`mt-3 flex flex-col gap-1 ${align} overflow-y-auto`}>
        {MAIN.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            expanded={wide}
            onNavigate={onClose}
          />
        ))}
      </nav>

      {/* Нижний блок */}
      <div className={`mt-auto pt-4 pb-3 border-t border-border ${align}`}>
        {FOOTER.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            expanded={wide}
            onNavigate={onClose}
          />
        ))}
      </div>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  active,
  expanded,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const className = useMemo(
    () =>
      [
        'group relative w-full rounded-lg',
        'transition-colors duration-200',
        'flex items-center gap-3',
        expanded ? 'px-3 py-2' : 'px-2 py-2 justify-center',
        active
          ? 'bg-primary/10 text-primary border border-primary/15'
          : 'text-muted-foreground hover:bg-muted/50',
      ].join(' '),
    [expanded, active]
  );

  return (
    <Link
      href={item.href}
      className={className}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={!expanded ? item.label : undefined} // тултип при свёрнутом
    >
      <Icon
        className={active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}
        size={18}
        aria-hidden="true"
      />
      {expanded && (
        <span className="text-sm truncate">
          {item.label}{' '}
          {item.badge && (
            <span className="ml-2 align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {item.badge}
            </span>
          )}
        </span>
      )}

      {/* Акцентная полоса слева (в расширенном виде) */}
      {expanded && active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded bg-primary" />
      )}
    </Link>
  );
}
