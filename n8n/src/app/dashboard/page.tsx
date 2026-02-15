"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { useAuth } from "@/contexts/auth-context";
import { CompanyAPI, type CompanyStats } from "@/lib/api/company"
import { TasksAPI, TaskStatus, type Task } from "@/lib/api/tasks"
import { OKRsAPI, type OKR } from "@/lib/api/okr"
import { CalendarAPI, type CalendarEvent } from "@/lib/api/calendar"
import { getNotifications, type NotificationItem } from "@/lib/api/notifications"
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart3, Target, Users, Brain, Bell, Calendar, CheckSquare, FolderOpen, Plus, FileText, ArrowUpRight, ChevronRight } from "lucide-react";

function DashboardHomeContentContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasRealData, setHasRealData] = useState<boolean | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myOkrs, setMyOkrs] = useState<OKR[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingWidgets, setIsLoadingWidgets] = useState(false);

  // Обновление времени каждую минуту
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setCompanyStats(null);
      setHasRealData(null);
      return () => {
        active = false;
      };
    }
    const loadStats = async () => {
      try {
        const stats = await CompanyAPI.getCompanyStats();
        if (!active) return;
        setCompanyStats(stats);
        const hasData = (stats.total_projects || 0) > 0 || (stats.total_clients || 0) > 0;
        setHasRealData(hasData);
      } catch {
        if (active) {
          setCompanyStats(null);
          setHasRealData(false);
        }
      }
    };
    loadStats();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setOrgId(null);
      return () => {
        active = false;
      };
    }
    const loadOrg = async () => {
      try {
        const company = await CompanyAPI.getCurrentCompany();
        if (!active) return;
        setOrgId(company?.id ?? null);
      } catch {
        if (active) setOrgId(null);
      }
    };
    loadOrg();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setMyTasks([]);
      setMyOkrs([]);
      setUpcomingEvents([]);
      setNotifications([]);
      return () => {
        active = false;
      };
    }

    const loadWidgets = async () => {
      setIsLoadingWidgets(true);
      const now = new Date();
      const startDate = now.toISOString().split("T")[0];
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const results = await Promise.allSettled([
        TasksAPI.getTasks({ assignee_id: user.id, per_page: 20 }),
        OKRsAPI.list({ status: "active", page_size: 6 }),
        CalendarAPI.getEvents({ start_date: startDate, end_date: endDate, page_size: 8 }),
        getNotifications({ orgId: orgId ?? undefined, pageSize: 6 }),
      ]);

      if (!active) return;

      const tasksResult = results[0];
      if (tasksResult.status === "fulfilled") {
        const filtered = tasksResult.value.filter(
          (task) => task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED
        );
        filtered.sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          return aDue - bDue;
        });
        setMyTasks(filtered.slice(0, 6));
      } else {
        setMyTasks([]);
      }

      const okrResult = results[1];
      if (okrResult.status === "fulfilled") {
        setMyOkrs(okrResult.value.slice(0, 4));
      } else {
        setMyOkrs([]);
      }

      const eventsResult = results[2];
      if (eventsResult.status === "fulfilled") {
        const sorted = [...eventsResult.value].sort((a, b) => {
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        });
        setUpcomingEvents(sorted.slice(0, 5));
      } else {
        setUpcomingEvents([]);
      }

      const notificationsResult = results[3];
      if (notificationsResult.status === "fulfilled") {
        setNotifications(notificationsResult.value.items.slice(0, 5));
      } else {
        setNotifications([]);
      }

      setIsLoadingWidgets(false);
    };

    loadWidgets().catch(() => {
      if (active) {
        setMyTasks([]);
        setMyOkrs([]);
        setUpcomingEvents([]);
        setNotifications([]);
        setIsLoadingWidgets(false);
      }
    });

    return () => {
      active = false;
    };
  }, [orgId, user]);

  const displayName = user?.full_name || user?.email || "друг";
  const displayFirstName = displayName.split(" ")[0].split("@")[0];

  const mainMetrics = [
    {
      title: "Проекты",
      value: companyStats ? String(companyStats.total_projects ?? 0) : "—",
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Команда",
      value: companyStats ? String(companyStats.total_employees ?? 0) : "—",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Клиенты",
      value: companyStats ? String(companyStats.total_clients ?? 0) : "—",
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Завершение",
      value: companyStats ? `${companyStats.completion_rate ?? 0}%` : "—",
      icon: BarChart3,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  const createActions = [
    { label: "Задачу", icon: CheckSquare, href: "/tasks?create=1" },
    { label: "Проект", icon: FolderOpen, href: "/projects/new" },
    { label: "OKR", icon: Target, href: "/goals/new" },
    { label: "Событие", icon: Calendar, href: "/calendar?create=1" },
  ];

  const aiInsights = [
    {
      id: 1,
      title: "Оптимизация бюджета",
      description: "Рекомендуем перераспределить 15% бюджета из канала A в канал B для увеличения ROI.",
      impact: "high",
      icon: Brain,
    },
    {
      id: 2,
      title: "Риск по проекту",
      description: "Проект «CRM Funnel Optimization» может задержаться. Рекомендуем добавить ресурс.",
      impact: "medium",
      icon: Brain,
    },
  ];

  const getTimeGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Доброе утро";
    if (hour < 17) return "Добрый день";
    return "Добрый вечер";
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return "Без срока";
    const date = new Date(value);
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const formatTimeAgo = (value: string) => {
    const now = new Date();
    const time = new Date(value);
    const diffMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return "только что";
    if (diffMinutes < 60) return `${diffMinutes}м назад`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}ч назад`;
    return `${Math.floor(diffMinutes / 1440)}д назад`;
  };

  const getEventDayLabel = (value: string) => {
    const eventDate = new Date(value);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (sameDay(eventDate, today)) return "Сегодня";
    if (sameDay(eventDate, tomorrow)) return "Завтра";
    return eventDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const getOkrProgress = (okr: OKR) => {
    if (typeof okr.overall_progress === "number") {
      return Math.round(okr.overall_progress);
    }
    if (!okr.key_results?.length) return 0;
    const values = okr.key_results.map((kr) => {
      if (typeof kr.progress_percentage === "number") return kr.progress_percentage;
      if (kr.target_value) return (kr.current_value / kr.target_value) * 100;
      return 0;
    });
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(Math.min(100, Math.max(0, avg)));
  };

  const getOkrStatusBadge = (status: OKR["status"]) => {
    switch (status) {
      case "active":
        return { label: "Активная", className: "bg-primary/10 text-primary border-primary/20" };
      case "completed":
        return { label: "Завершена", className: "bg-green-100 text-green-800 border-green-200" };
      case "archived":
        return { label: "Архив", className: "bg-muted/60 text-muted-foreground border-border/80" };
      default:
        return { label: "Черновик", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    }
  };

  const getTaskStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IN_PROGRESS:
        return { label: "В работе", className: "bg-primary/10 text-primary border-primary/20" };
      case TaskStatus.IN_REVIEW:
        return { label: "На проверке", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
      case TaskStatus.BLOCKED:
        return { label: "Заблокирована", className: "bg-red-100 text-red-800 border-red-200" };
      case TaskStatus.DONE:
        return { label: "Готово", className: "bg-green-100 text-green-800 border-green-200" };
      case TaskStatus.CANCELLED:
        return { label: "Отменена", className: "bg-muted/60 text-muted-foreground border-border/80" };
      default:
        return { label: "К выполнению", className: "bg-muted/60 text-muted-foreground border-border/80" };
    }
  };

  const getEventTypeLabel = (eventType: CalendarEvent["event_type"]) => {
    switch (eventType) {
      case "meeting":
        return "Встреча";
      case "task_deadline":
        return "Дедлайн задачи";
      case "project_milestone":
        return "Веха проекта";
      case "okr_review":
        return "OKR обзор";
      case "personal":
        return "Личное";
      case "holiday":
        return "Праздник";
      case "vacation":
        return "Отпуск";
      default:
        return "Событие";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${getTimeGreeting()}, ${displayFirstName}!`}
        description="Вот что происходит в вашей организации сегодня"
        meta={
          hasRealData === false ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Демо-данные</Badge>
              <span>Подключите источники, чтобы заменить их реальными метриками.</span>
            </div>
          ) : null
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/calendar")}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {currentTime.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long'
              })}
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Создать:</span>
              {createActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.label}
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    onClick={() => router.push(action.href)}
                  >
                    <Icon className="w-4 h-4" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        }
      />

      {hasRealData === false && (
        <Card className="glass-card">
          <CardContent>
            <AnalyticsEmptyState
              context="dashboard"
              title="Дашборд в демо-режиме"
              description="Пока источники не подключены, мы показываем демо-метрики и примерные карточки."
              size="sm"
            />
          </CardContent>
        </Card>
      )}

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow glass-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold">{metric.value}</p>
                    </div>
                  </div>
                  <div className={`${metric.bgColor} p-3 rounded-lg`}>
                    <Icon className={`w-6 h-6 ${metric.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Левая колонка */}
        <div className="lg:col-span-2 space-y-6">
          {/* Активные цели */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Мои OKR
                </CardTitle>
                <CardDescription>
                  Цели и прогресс вашей команды
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/okr")}>
                Все цели
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingWidgets ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : myOkrs.length > 0 ? (
                myOkrs.map((okr) => {
                  const progress = getOkrProgress(okr);
                  const status = getOkrStatusBadge(okr.status);
                  return (
                    <div key={okr.id} className="p-4 border rounded-lg hover:bg-muted/40 transition-colors">
                      <div className="flex items-start justify-between mb-3 gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1 truncate">{okr.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge className={status.className} variant="outline">
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              До {formatShortDate(okr.due_date)}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          KR: {okr.key_results?.length ?? 0}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Прогресс</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  Нет активных OKR. Создайте цель, чтобы отслеживать прогресс.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Мои задачи */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Мои задачи
                </CardTitle>
                <CardDescription>
                  Ближайшие задачи и сроки
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/tasks")}>
                Все задачи
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingWidgets ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : myTasks.length > 0 ? (
                myTasks.map((task) => {
                  const status = getTaskStatusBadge(task.status);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">Срок: {formatShortDate(task.due_date)}</p>
                      </div>
                      <Badge className={status.className} variant="outline">
                        {status.label}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  Нет активных задач. Создайте задачу или обновите статус.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push("/tasks/new")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать задачу
              </Button>
            </CardContent>
          </Card>

          {/* AI Инсайты */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI Рекомендации
              </CardTitle>
              <CardDescription>
                Умные предложения для оптимизации работы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiInsights.map((insight) => {
                const Icon = insight.icon;
                return (
                  <div key={insight.id} className={`p-4 border-l-4 bg-muted/40 rounded-2xl ${getImpactColor(insight.impact)}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 p-2 bg-card rounded-xl shadow-sm">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => router.push("/ai")}
                          >
                            Применить
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => router.push("/ai")}
                          >
                            Подробнее
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Правая колонка */}
        <div className="space-y-6">
          {/* Предстоящие события */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                Расписание
              </CardTitle>
              <CardDescription>
                Ближайшие события
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingWidgets ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => {
                  const startTime = new Date(event.start_date).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={event.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 rounded-lg transition-colors">
                      <div className="flex-shrink-0 w-14 text-center">
                        <div className="text-sm font-medium">{startTime}</div>
                        <div className="text-xs text-muted-foreground">{getEventDayLabel(event.start_date)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{event.title}</h4>
                        <p className="text-xs text-muted-foreground">{getEventTypeLabel(event.event_type)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0"
                        onClick={() => router.push("/calendar")}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  Нет запланированных событий на ближайшую неделю.
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push("/calendar")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить событие
              </Button>
            </CardContent>
          </Card>

          {/* Уведомления */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-600" />
                  Уведомления
                </CardTitle>
                <CardDescription>
                  Последние события и системные сообщения
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/notifications")}>
                Все
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingWidgets ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((notification) => {
                  const isUnread = notification.status === "unread";
                  return (
                    <div key={notification.id} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-muted/60 rounded-full flex items-center justify-center">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{notification.title}</p>
                          {isUnread && <span className="w-2 h-2 rounded-full bg-primary/100" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(notification.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  Нет новых уведомлений. Всё под контролем.
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

// Wrap with authentication protection
export default function DashboardHomeContent() {
  return (
    <ProtectedRoute requireAuth={true}>
      <DashboardHomeContentContent />
    </ProtectedRoute>
  )
}
