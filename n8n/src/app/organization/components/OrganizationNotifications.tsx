// components/organization/OrganizationNotifications.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, NotificationItem } from "@/lib/api/notifications";
import { Bell, X, UserPlus, Users, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface Notification {
  id: string;
  type: 'invite_pending' | 'member_joined' | 'department_created' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

interface OrganizationNotificationsProps {
  orgId: string;
  limit?: number;
}

export function OrganizationNotifications({ orgId, limit = 5 }: OrganizationNotificationsProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const mapNotification = useCallback((item: NotificationItem): Notification => {
    const typeMap: Record<string, Notification["type"]> = {
      invitation: "invite_pending",
      okr_update: "info",
      kpi_alert: "warning",
      project_update: "info",
      task_assigned: "info",
      task_completed: "success",
      task_overdue: "warning",
      deadline_reminder: "warning",
      comment: "info",
      mention: "info",
      system: "info",
    };
    return {
      id: item.id,
      type: typeMap[item.type] || "info",
      title: item.title,
      message: item.message,
      timestamp: item.created_at,
      read: item.status === "read" || item.status === "archived",
      actionUrl: item.action_url || undefined,
      relatedEntityType: item.related_entity_type ?? null,
      relatedEntityId: item.related_entity_id ?? null,
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getNotifications({ orgId, pageSize: limit });
        if (!active) return;
        setNotifications(data.items.map(mapNotification));
      } catch {
        if (active) setNotifications([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [orgId, limit, mapNotification]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invite_pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'member_joined':
        return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'department_created':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getEntityBadge = (type?: string | null) => {
    if (!type) return null;
    const key = type.toLowerCase();
    if (key === "kpi") return { label: "KPI", variant: "success" as const };
    if (key === "objective" || key === "key_result" || key === "okr") {
      return { label: "OKR", variant: "warning" as const };
    }
    if (key === "project") return { label: "Project", variant: "outline" as const };
    return null;
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'только что';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}м назад`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}ч назад`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}д назад`;
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch {
      // silent
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch {
      // silent
    }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5" />
            Уведомления
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5" />
            Уведомления
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Нет новых уведомлений</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5" />
            Уведомления
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={async () => {
                await markAllNotificationsRead(orgId);
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
              }}
            >
              Прочитать все
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`p-3 rounded-lg border transition-colors ${
                notification.read ? 'bg-slate-50' : 'bg-blue-50 border-blue-200'
              }`}
              onClick={() => openNotification(notification)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openNotification(notification);
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-medium ${!notification.read ? 'text-blue-900' : 'text-slate-900'}`}>
                        {notification.title}
                      </p>
                      {(() => {
                        const badge = getEntityBadge(notification.relatedEntityType);
                        if (!badge) return null;
                        return (
                          <Badge variant={badge.variant} className="text-[10px] px-2 py-0.5">
                            {badge.label}
                          </Badge>
                        );
                      })()}
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{notification.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatTimeAgo(notification.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <CheckCircle className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissNotification(notification.id);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {notifications.length >= limit && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/notifications")}
            >
              Показать все уведомления
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
