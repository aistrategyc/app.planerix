// components/organization/OrganizationOverview.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  MapPin, 
  Calendar,
  Globe,
  Phone,
  Briefcase,
  ChevronRight
} from "lucide-react";
import type { Organization, Member } from "../hooks/useOrganization";

interface OrganizationOverviewProps {
  organization: Organization;
  members: Member[];
  onTabChange: (tab: string) => void;
  getRoleIcon: (role: string) => React.ReactNode;
}

export function OrganizationOverview({ 
  organization, 
  members, 
  onTabChange, 
  getRoleIcon 
}: OrganizationOverviewProps) {
  const recentMembers = members
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
    .slice(0, 5);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Информация об организации */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Информация об организации</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-sm text-slate-600 mb-2">Основные данные</h4>
              <div className="space-y-3">
                {organization.industry && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{organization.industry}</span>
                  </div>
                )}
                {organization.size && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">
                      {organization.size === 'small' ? 'Маленькая компания' : 'Средняя компания'}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">
                    Создана {new Date(organization.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-sm text-slate-600 mb-2">Контакты</h4>
              <div className="space-y-3">
                {organization.custom_fields?.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <a 
                      href={organization.custom_fields.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {organization.custom_fields.website}
                    </a>
                  </div>
                )}
                {organization.custom_fields?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{organization.custom_fields.phone}</span>
                  </div>
                )}
                {organization.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">
                      {[
                        organization.address.city,
                        organization.address.country
                      ].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Последние участники */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Новые участники</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onTabChange("members")}>
            Все участники
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={member.user.avatar_url} />
                  <AvatarFallback>
                    {(member.user.first_name?.[0] || '') + (member.user.last_name?.[0] || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.user.first_name} {member.user.last_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {member.role === 'owner' ? 'Владелец' :
                     member.role === 'admin' ? 'Администратор' : 
                     member.role === 'member' ? 'Участник' : 'Наблюдатель'}
                  </p>
                </div>
                {getRoleIcon(member.role)}
              </div>
            ))}
            {recentMembers.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                Нет участников
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
