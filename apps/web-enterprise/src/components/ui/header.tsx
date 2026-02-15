'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Menu, Calendar, MessageSquare, Sparkles, User, LogOut, Settings as SettingsIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronsUpDown } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context';
import { CompanyAPI } from '@/lib/api/company';
import { NotificationBell } from '@/components/ui/notification-bell';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
  NotificationType,
} from '@/lib/api/notifications';

type HeaderProps = {
  /** Опционально: хендлер для открытия мобильного сайдбара */
  onMenuClick?: () => void;
};

export default function Header({ onMenuClick }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    timestamp: Date;
    read: boolean;
    actionUrl?: string;
    tag?: string;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!user) {
          if (isMounted) {
            setCompanyName(null);
            setOrgId(null);
          }
          return;
        }
        const company = await CompanyAPI.getCurrentCompany();
        if (isMounted) {
          setCompanyName(company?.name ?? null);
          setOrgId(company?.id ?? null);
        }
      } catch {
        if (isMounted) {
          setCompanyName(null);
          setOrgId(null);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user || !orgId) {
      setNotifications([]);
      setUnreadCount(0);
      return () => {
        active = false;
      };
    }

    const mapNotificationType = (type: NotificationType) => {
      const map: Record<NotificationType, "info" | "success" | "warning" | "error"> = {
        system: "info",
        task_assigned: "info",
        task_completed: "success",
        task_overdue: "warning",
        project_update: "info",
        mention: "info",
        comment: "info",
        deadline_reminder: "warning",
        okr_update: "info",
        kpi_alert: "warning",
        invitation: "info",
      };
      return map[type] ?? "info";
    };

    const mapNotification = (item: NotificationItem) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      type: mapNotificationType(item.type),
      timestamp: new Date(item.created_at),
      read: item.status === "read" || item.status === "archived",
      actionUrl: item.action_url ?? undefined,
      tag: (() => {
        const key = item.related_entity_type?.toLowerCase();
        if (!key) return undefined;
        if (key === "kpi") return "KPI";
        if (key === "objective" || key === "key_result" || key === "okr") return "OKR";
        if (key === "project") return "Project";
        return undefined;
      })(),
    });

    (async () => {
      try {
        const data = await getNotifications({ orgId, pageSize: 20 });
        if (!active) return;
        const items = data.items.map(mapNotification);
        const computedUnread = items.filter((item) => !item.read).length;
        setNotifications(items);
        setUnreadCount(typeof data.unread_count === "number" ? data.unread_count : computedUnread);
      } catch {
        if (active) {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user, orgId]);

  const handleNotificationClick = (notification: { actionUrl?: string }) => {
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      return;
    }
    router.push("/notifications");
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!orgId) return;
    try {
      await markAllNotificationsRead(orgId);
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'glass-panel shadow-sm border-b border-border' : 'glass-panel'
      }`}
    >
      <nav className="mx-auto flex w-full max-w-[1400px] items-center gap-4 py-3 pl-4 pr-4 md:pl-[80px] md:pr-6">
        <div className="flex w-full items-center justify-between gap-4">
          {/* Бургер (моб.) */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-full p-2 text-muted-foreground hover:bg-muted/60 transition-colors"
            onClick={onMenuClick}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Логотип */}
          <Link href="/dashboard" className="flex items-center space-x-2 select-none">
            <img
              src="/planerixlogoicon.png"
              alt="Planerix logo"
              className="w-10 h-10 object-contain"
            />
            <span className="text-2xl font-bold text-foreground">Planerix</span>
          </Link>

          <div className="hidden lg:flex flex-1" />

          {/* Правый блок действий */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <button
                  className="inline-flex items-center justify-center rounded-full p-2 hover:bg-muted/60 transition-colors"
                  onClick={() => router.push('/calendar')}
                  aria-label="Calendar"
                  title="Calendar"
                >
                  <Calendar size={18} className="text-muted-foreground" />
                </button>

                <button
                  className="inline-flex items-center justify-center rounded-full p-2 hover:bg-muted/60 transition-colors"
                  onClick={() => router.push('/ai')}
                  aria-label="AI Center"
                  title="AI Center"
                >
                  <Sparkles size={18} className="text-muted-foreground" />
                </button>

                <button
                  className="inline-flex items-center justify-center rounded-full p-2 hover:bg-muted/60 transition-colors"
                  onClick={() => router.push('/ai/chat')}
                  aria-label="AI Chat"
                  title="AI Chat"
                >
                  <MessageSquare size={18} className="text-muted-foreground" />
                </button>

                <NotificationBell
                  notifications={notifications}
                  count={unreadCount}
                  onNotificationClick={handleNotificationClick}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAllAsRead={handleMarkAllAsRead}
                  viewAllHref="/notifications"
                  viewAllLabel="Все уведомления"
                  className="text-muted-foreground hover:bg-muted/60"
                />

                {/* User/Org dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-muted/60 transition-colors"
                      aria-label="User menu"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(user.full_name || user.email || '?')
                            .split(' ')
                            .map((s) => s[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden lg:flex flex-col items-start leading-tight max-w-[180px]">
                        <span className="text-sm font-medium text-foreground truncate">
                          {user.full_name || user.email}
                        </span>
                        {companyName ? (
                          <span className="text-xs text-muted-foreground truncate" title={companyName}>
                            {companyName}
                          </span>
                        ) : null}
                      </div>
                      <ChevronsUpDown className="h-4 w-4 text-muted-foreground hidden md:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {(user.full_name || user.email || '?')
                              .split(' ')
                              .map((s) => s[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium leading-tight truncate">
                            {user.full_name || user.email}
                          </div>
                          {companyName ? (
                            <div className="text-xs text-muted-foreground truncate" title={companyName}>
                              {companyName}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => router.push('/profile')}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Профиль</span>
                        <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/organization')}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Организация</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/profile')}>
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        <span>Настройки</span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          await logout();
                        } catch {
                          // ignore; state handled in useAuth
                        }
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Выйти</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Unauthenticated: show quick links */}
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 shadow-md transition-all hover:translate-y-[-1px]"
                >
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

    </header>
  );
}
