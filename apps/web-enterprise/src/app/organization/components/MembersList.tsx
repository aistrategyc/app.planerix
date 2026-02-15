"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search,
  Download,
  MoreHorizontal,
  Users
} from "lucide-react";
import type { Member } from "../hooks/useOrganization";

interface MembersListProps {
  members: Member[];
  getRoleIcon: (role: string) => React.ReactNode;
  getRoleName: (role: string) => string;
  onMemberAction?: (memberId: string, action: string) => void;
}

export function MembersList({ 
  members, 
  getRoleIcon, 
  getRoleName,
  onMemberAction 
}: MembersListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Активен</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Ожидает</Badge>;
      case 'inactive':
        return <Badge className="bg-slate-100 text-slate-800">Неактивен</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = searchTerm === "" || 
      member.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${member.user.first_name} ${member.user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Поиск и фильтры */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Поиск участников..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все роли</SelectItem>
                <SelectItem value="owner">Владельцы</SelectItem>
                <SelectItem value="admin">Администраторы</SelectItem>
                <SelectItem value="bu_manager">Руководители направлений</SelectItem>
                <SelectItem value="hod">Руководители отделов</SelectItem>
                <SelectItem value="team_lead">Тимлиды</SelectItem>
                <SelectItem value="pmo">PMO/HR/Finance</SelectItem>
                <SelectItem value="member">Участники</SelectItem>
                <SelectItem value="guest">Гости</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Список участников */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Участники организации</CardTitle>
            <CardDescription>
              Найдено {filteredMembers.length} из {members.length} участников
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={member.user.avatar_url} />
                    <AvatarFallback>
                      {(member.user.first_name?.[0] || '') + (member.user.last_name?.[0] || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {member.user.first_name} {member.user.last_name}
                      </p>
                      {getRoleIcon(member.role)}
                    </div>
                    <p className="text-sm text-slate-500">{member.user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getRoleName(member.role)}
                      </Badge>
                      {member.department && (
                        <Badge variant="outline" className="text-xs">
                          {member.department.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(member.status)}
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      Присоединился {new Date(member.joined_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onMemberAction?.(member.id, 'menu')}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {filteredMembers.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Участники не найдены</h3>
                <p className="text-slate-500">
                  {searchTerm || roleFilter !== "all" 
                    ? "Попробуйте изменить параметры поиска" 
                    : "В организации пока нет участников"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
