// src/app/organization/components/RecentActivity.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuditLogs, AuditLogItem } from "@/lib/api/audit";
import { Activity, UserPlus, Plus, Edit, Users } from "lucide-react";

interface ActivityItem {
  id: string;
  type: 'member_joined' | 'department_created' | 'organization_updated' | 'member_invited';
  user?: {
    name: string;
    avatar?: string;
  };
  description: string;
  timestamp: string;
}

interface RecentActivityProps {
  orgId: string;
  limit?: number;
}

export function RecentActivity({ orgId, limit = 10 }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const mapAuditToActivity = useCallback((log: AuditLogItem): ActivityItem => {
    const actorName = log.actor?.full_name || log.actor?.username || log.actor?.email || "System";
    const metadata = log.metadata || {};

    if (log.event_type.startsWith("dept.create")) {
      const deptName = metadata.name ? ` "${metadata.name}"` : "";
      return {
        id: log.id,
        type: "department_created",
        user: { name: actorName },
        description: `создал отдел${deptName}`,
        timestamp: log.created_at,
      };
    }

    if (log.event_type.startsWith("membership.create")) {
      return {
        id: log.id,
        type: "member_joined",
        user: { name: actorName },
        description: "добавил нового участника",
        timestamp: log.created_at,
      };
    }

    if (log.event_type.startsWith("membership.invite") || log.event_type.startsWith("invitations.create")) {
      return {
        id: log.id,
        type: "member_invited",
        user: { name: actorName },
        description: "отправил приглашение",
        timestamp: log.created_at,
      };
    }

    if (log.event_type.startsWith("org.update") || log.event_type.startsWith("org.create")) {
      return {
        id: log.id,
        type: "organization_updated",
        user: { name: actorName },
        description: "обновил организацию",
        timestamp: log.created_at,
      };
    }

    return {
      id: log.id,
      type: "organization_updated",
      user: { name: actorName },
      description: log.event_type.replace(/_/g, " "),
      timestamp: log.created_at,
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getAuditLogs({
          orgId,
          page: 1,
          pageSize: limit,
        });
        if (!active) return;
        const mapped = data.items.map(mapAuditToActivity);
        setActivities(mapped);
      } catch {
        if (!active) return;
        setActivities([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [orgId, limit, mapAuditToActivity]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'member_joined':
        return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'department_created':
        return <Plus className="w-4 h-4 text-blue-600" />;
      case 'organization_updated':
        return <Edit className="w-4 h-4 text-orange-600" />;
      case 'member_invited':
        return <Users className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'только что';
    } else if (diffInHours < 24) {
      return `${diffInHours}ч назад`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}д назад`;
    }
  };

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
        <h3 className="text-base font-medium mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Последняя активность
        </h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-base font-medium mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        Последняя активность
      </h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              {getActivityIcon(activity.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{activity.user?.name}</span>
                {' '}
                <span className="text-muted-foreground">{activity.description}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTimeAgo(activity.timestamp)}
              </p>
            </div>
          </div>
        ))}
        
        {activities.length === 0 && (
          <div className="text-center py-6">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Нет активности</p>
          </div>
        )}
      </div>
    </div>
  );
}
