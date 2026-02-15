"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users,
  MoreHorizontal,
  Briefcase,
  Plus
} from "lucide-react";
import { CreateDepartmentDialog } from "./CreateDepartmentDialog";
import type { Department, Member } from "../hooks/useOrganization";

interface DepartmentsListProps {
  orgId: string;
  departments: Department[];
  members: Member[];
  onDepartmentCreated?: () => void;
  onDepartmentAction?: (departmentId: string, action: string) => void;
}

export function DepartmentsList({ 
  orgId,
  departments, 
  members,
  onDepartmentCreated,
  onDepartmentAction 
}: DepartmentsListProps) {
  return (
    <div className="space-y-6">
      {/* Заголовок отделов */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Отделы</h2>
          <p className="text-sm text-slate-500">Управление структурой организации</p>
        </div>
        <CreateDepartmentDialog
          orgId={orgId}
          members={members}
          onDepartmentCreated={onDepartmentCreated}
          trigger={
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Создать отдел
            </Button>
          }
        />
      </div>

      {/* Список отделов */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((department) => (
          <Card key={department.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium">{department.name}</h3>
                  {department.description && (
                    <p className="text-sm text-slate-500 mt-1">{department.description}</p>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onDepartmentAction?.(department.id, 'menu')}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4" />
                  <span>{department.member_count || 0} участников</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  Активен
                </Badge>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-slate-500">
                  Создан {new Date(department.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {departments.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Нет отделов</h3>
            <p className="text-slate-500 mb-4">Создайте первый отдел для структурирования команды</p>
            <CreateDepartmentDialog
              orgId={orgId}
              members={members}
              onDepartmentCreated={onDepartmentCreated}
              trigger={
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать отдел
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}