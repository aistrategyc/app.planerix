// components/organization/CreateDepartmentDialog.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, AlertCircle, CheckCircle } from "lucide-react";
import { useOrganizationDepartments } from "../hooks/useOrganization";
import type { Member } from "../hooks/useOrganization";

interface CreateDepartmentDialogProps {
  orgId: string;
  members?: Member[];
  trigger?: React.ReactNode;
  onDepartmentCreated?: () => void;
}

interface DepartmentFormData {
  name: string;
  description: string;
  manager_id: string;
}

export function CreateDepartmentDialog({ 
  orgId, 
  members = [],
  trigger,
  onDepartmentCreated
}: CreateDepartmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Используем хук для создания отдела
  const { createDepartment } = useOrganizationDepartments(orgId);

  const [formData, setFormData] = useState<DepartmentFormData>({
    name: "",
    description: "",
    manager_id: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Валидация формы
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Название отдела обязательно";
    } else if (formData.name.length > 120) {
      errors.name = "Название не может быть длиннее 120 символов";
    }

    if (formData.description.length > 500) {
      errors.description = "Описание не может быть длиннее 500 символов";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      const departmentData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        manager_id: formData.manager_id || undefined
      };

      // Используем метод из хука
      await createDepartment(departmentData);
      
      // Сброс формы и закрытие диалога
      handleReset();
      setIsOpen(false);
      
      // Вызываем колбэк, если передан
      onDepartmentCreated?.();
      
    } catch (error) {
      console.error('Error creating department:', error);
      // Ошибка уже обработана в хуке через toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ name: "", description: "", manager_id: "" });
    setValidationErrors({});
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    handleReset();
    setIsOpen(false);
  };

  // Фильтруем участников, которые могут быть менеджерами
  const eligibleManagers = members.filter(member => 
    ['admin', 'member'].includes(member.role) && member.status === 'active'
  );

  // Функция для обновления поля формы
  const updateField = (field: keyof DepartmentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Очищаем ошибку валидации при изменении поля
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Создать отдел
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Создать новый отдел
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Название отдела */}
          <div>
            <Label htmlFor="dept-name" className="flex items-center gap-1">
              Название отдела
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="dept-name"
              placeholder="Например, Маркетинг"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              maxLength={120}
              required
              className={validationErrors.name ? 'border-red-500' : ''}
            />
            {validationErrors.name && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationErrors.name}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {formData.name.length}/120 символов
            </p>
          </div>

          {/* Описание */}
          <div>
            <Label htmlFor="dept-description">Описание</Label>
            <Textarea
              id="dept-description"
              placeholder="Краткое описание отдела и его функций"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              maxLength={500}
              className={validationErrors.description ? 'border-red-500' : ''}
            />
            {validationErrors.description && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationErrors.description}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {formData.description.length}/500 символов
            </p>
          </div>

          {/* Менеджер отдела */}
          {eligibleManagers.length > 0 && (
            <div>
              <Label htmlFor="dept-manager">Менеджер отдела</Label>
              <Select 
                value={formData.manager_id} 
                onValueChange={(value) => updateField('manager_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите менеджера (необязательно)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без менеджера</SelectItem>
                  {eligibleManagers.map(member => (
                    <SelectItem key={member.user.id} value={member.user.id}>
                      <div className="flex items-center gap-2">
                        <span>
                          {member.user.first_name} {member.user.last_name}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({member.user.email})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Менеджер отдела сможет управлять участниками и проектами
              </p>
            </div>
          )}

          {/* Предупреждение о отсутствии подходящих менеджеров */}
          {eligibleManagers.length === 0 && members.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <p className="text-sm font-medium text-yellow-800">
                  Нет подходящих менеджеров
                </p>
              </div>
              <p className="text-sm text-yellow-700">
                В организации нет активных участников с ролью &quot;Администратор&quot; или &quot;Участник&quot; 
                для назначения менеджером отдела.
              </p>
            </div>
          )}

          {/* Информация о правах */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-medium text-blue-800">
                Что получит новый отдел:
              </h4>
            </div>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Собственное пространство для проектов</li>
              <li>• Возможность приглашать участников</li>
              <li>• Статистика и отчеты по отделу</li>
              <li>• Настройки доступа и прав</li>
            </ul>
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Создание...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать отдел
                </>
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
