"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, Activity } from "lucide-react";
import type { OrganizationStats } from "../hooks/useOrganization";

interface OrganizationMetricsProps {
  stats: OrganizationStats;
  timeRange?: string;
}

export function OrganizationMetrics({ stats, timeRange = "30d" }: OrganizationMetricsProps) {
  const activePct = stats.totalMembers > 0 
    ? Math.round((stats.activeMembers / stats.totalMembers) * 100)
    : 0;
  const metrics = [
    {
      label: 'Рост участников',
      value: `+${stats.monthlyGrowth}%`,
      trend: stats.monthlyGrowth > 0 ? 'up' : 'down',
      icon: <TrendingUp className="w-4 h-4" />,
      color: stats.monthlyGrowth > 0 ? 'text-green-600' : 'text-red-600'
    },
    {
      label: 'Активность',
      value: `${activePct}%`,
      progress: activePct,
      icon: <Activity className="w-4 h-4" />,
      color: 'text-blue-600'
    },
    {
      label: 'Завершенность профиля',
      value: '85%',
      progress: 85,
      icon: <Target className="w-4 h-4" />,
      color: 'text-purple-600'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Метрики организации</CardTitle>
          <Badge variant="outline" className="text-xs">
            Последние {timeRange === '30d' ? '30 дней' : timeRange}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={metric.color}>
                  {metric.icon}
                </div>
                <span className="text-sm font-medium">{metric.label}</span>
              </div>
              <span className={`text-sm font-bold ${metric.color}`}>
                {metric.value}
              </span>
            </div>
            
            {metric.progress !== undefined && (
              <Progress 
                value={metric.progress} 
                className="h-2"
              />
            )}
          </div>
        ))}
        
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Обновлено</span>
            <span>{new Date().toLocaleTimeString('ru-RU')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
