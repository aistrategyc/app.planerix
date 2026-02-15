"use client";

import { UserPlus, Plus, Download, BarChart3 } from "lucide-react";

interface QuickActionsProps {
  onInviteMember: () => void;
  onCreateDepartment: () => void;
  onExportData: () => void;
  onViewAnalytics: () => void;
}

export function QuickActions({
  onInviteMember,
  onCreateDepartment,
  onExportData,
  onViewAnalytics
}: QuickActionsProps) {
  const actions = [
    {
      id: 'invite',
      label: 'Пригласить участника',
      icon: <UserPlus className="w-4 h-4" />,
      onClick: onInviteMember,
      variant: 'default' as const,
      description: 'Добавить нового участника в организацию'
    },
    {
      id: 'department',
      label: 'Создать отдел',
      icon: <Plus className="w-4 h-4" />,
      onClick: onCreateDepartment,
      variant: 'outline' as const,
      description: 'Структурировать команду по отделам'
    },
    {
      id: 'export',
      label: 'Экспорт данных',
      icon: <Download className="w-4 h-4" />,
      onClick: onExportData,
      variant: 'outline' as const,
      description: 'Скачать данные организации'
    },
    {
      id: 'analytics',
      label: 'Аналитика',
      icon: <BarChart3 className="w-4 h-4" />,
      onClick: onViewAnalytics,
      variant: 'outline' as const,
      description: 'Просмотр статистики и отчетов'
    }
  ];

  return (
    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-base font-medium mb-4">Быстрые действия</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`h-auto p-4 flex flex-col items-center gap-2 rounded-xl border transition-colors ${
              action.variant === 'default' 
                ? 'bg-primary text-primary-foreground hover:opacity-90' 
                : 'bg-card border-border hover:bg-muted/40'
            }`}
          >
            {action.icon}
            <span className="text-xs text-center">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
