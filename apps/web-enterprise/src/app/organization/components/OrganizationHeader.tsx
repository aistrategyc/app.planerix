"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Building2, Copy, Edit, UserPlus, MoreHorizontal, Settings, Download, Archive, Trash2 } from "lucide-react";
import type { Organization } from "../hooks/useOrganization";

interface OrganizationHeaderProps {
  organization: Organization;
  onEdit: () => void;
  onInvite: () => void;
  onCopyUrl: () => void;
  canManage?: boolean;
}

export function OrganizationHeader({
  organization,
  onEdit,
  onInvite,
  onCopyUrl,
  canManage = true
}: OrganizationHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getIndustryLabel = (industry?: string) => {
    const industryMap = {
      'it': 'IT',
      'marketing': 'Маркетинг',
      'retail': 'Ритейл',
      'education': 'Образование',
      'healthcare': 'Здравоохранение',
      'finance': 'Финансы',
      'other': 'Другое'
    };
    return industry ? industryMap[industry as keyof typeof industryMap] || industry : null;
  };

  const getSizeLabel = (size?: string) => {
    const sizeMap = {
      'startup': 'Стартап',
      'small': 'Малая',
      'medium': 'Средняя',
      'large': 'Крупная',
      'enterprise': 'Корпорация'
    };
    return size ? sizeMap[size as keyof typeof sizeMap] || size : null;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                {organization.name}
              </h1>
              {organization.industry && (
                <Badge variant="outline" className="text-xs">
                  {getIndustryLabel(organization.industry)}
                </Badge>
              )}
              {organization.size && (
                <Badge variant="outline" className="text-xs">
                  {getSizeLabel(organization.size)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>/{organization.slug}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-1"
                onClick={onCopyUrl}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
        
        {organization.description && (
          <p className="text-muted-foreground max-w-2xl">{organization.description}</p>
        )}
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Создана {new Date(organization.created_at).toLocaleDateString('ru-RU')}</span>
          {organization.updated_at !== organization.created_at && (
            <span>Обновлена {new Date(organization.updated_at).toLocaleDateString('ru-RU')}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button onClick={onInvite}>
          <UserPlus className="w-4 h-4 mr-2" />
          Пригласить
        </Button>

        {canManage && (
          <>
            <Button variant="outline" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Редактировать
            </Button>

            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => {}}>
                  <Settings className="w-4 h-4 mr-2" />
                  Настройки
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}}>
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт данных
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}}>
                  <Archive className="w-4 h-4 mr-2" />
                  Архивировать
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {}} 
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
