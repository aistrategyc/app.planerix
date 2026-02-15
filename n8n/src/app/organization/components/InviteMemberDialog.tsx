// components/organization/InviteMemberDialog.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, Mail, AlertCircle, CheckCircle } from "lucide-react";
import type { Department } from "../hooks/useOrganization";
import { MembershipRole, RoleLabels } from "@/types/roles";
import { OnboardingAPI } from "@/lib/api/onboarding";

interface InviteMemberDialogProps {
  orgId: string;
  departments?: Department[];
  onMemberInvited?: () => void;
  trigger?: React.ReactNode;
}

interface InviteFormData {
  email: string;
  role: MembershipRole;
  department_id: string;
}

export function InviteMemberDialog({ 
  orgId, 
  departments = [],
  onMemberInvited,
  trigger 
}: InviteMemberDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const [formData, setFormData] = useState<InviteFormData>({
    email: "",
    role: "member",
    department_id: ""
  });

  // Валидация email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = "Email обязателен";
    } else if (!validateEmail(formData.email)) {
      errors.email = "Некорректный формат email";
    }

    if (!formData.role) {
      errors.role = "Выберите роль";
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
      
      const inviteData = {
        email: formData.email.trim(),
        role: formData.role,
        department_id: formData.department_id || undefined
      };

      await OnboardingAPI.createInvite(orgId, inviteData);
      
      toast({
        title: "Приглашение отправлено",
        description: `Приглашение отправлено на ${formData.email}`
      });

      // Сброс формы
      setFormData({ email: "", role: "member", department_id: "" });
      setIsOpen(false);
      setValidationErrors({});
      
      // Callback для обновления данных
      onMemberInvited?.();
      
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить приглашение",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof InviteFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Очищаем ошибку валидации
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCancel = () => {
    setFormData({ email: "", role: "member", department_id: "" });
    setValidationErrors({});
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Пригласить участника
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Пригласить участника
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <Label htmlFor="invite-email" className="flex items-center gap-1">
              Email
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
              className={validationErrors.email ? 'border-red-500' : ''}
            />
            {validationErrors.email && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationErrors.email}
              </p>
            )}
          </div>

          {/* Роль */}
          <div>
            <Label htmlFor="invite-role" className="flex items-center gap-1">
              Роль
              <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => updateField('role', value)}
            >
              <SelectTrigger className={validationErrors.role ? 'border-red-500' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div>
                    <div className="font-medium">{RoleLabels.admin}</div>
                    <div className="text-xs text-slate-500">Административный доступ</div>
                  </div>
                </SelectItem>
                <SelectItem value="bu_manager">
                  <div>
                    <div className="font-medium">{RoleLabels.bu_manager}</div>
                    <div className="text-xs text-slate-500">Управление бизнес-подразделением</div>
                  </div>
                </SelectItem>
                <SelectItem value="hod">
                  <div>
                    <div className="font-medium">{RoleLabels.hod}</div>
                    <div className="text-xs text-slate-500">Управление отделом</div>
                  </div>
                </SelectItem>
                <SelectItem value="team_lead">
                  <div>
                    <div className="font-medium">{RoleLabels.team_lead}</div>
                    <div className="text-xs text-slate-500">Управление командой</div>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div>
                    <div className="font-medium">{RoleLabels.member}</div>
                    <div className="text-xs text-slate-500">Базовые права участника</div>
                  </div>
                </SelectItem>
                <SelectItem value="pmo">
                  <div>
                    <div className="font-medium">{RoleLabels.pmo}</div>
                    <div className="text-xs text-slate-500">Аналитика и отчетность</div>
                  </div>
                </SelectItem>
                <SelectItem value="guest">
                  <div>
                    <div className="font-medium">{RoleLabels.guest}</div>
                    <div className="text-xs text-slate-500">Только чтение</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {validationErrors.role && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {validationErrors.role}
              </p>
            )}
          </div>

          {/* Отдел */}
          {departments.length > 0 && (
            <div>
              <Label htmlFor="invite-department">Отдел (необязательно)</Label>
              <Select 
                value={formData.department_id} 
                onValueChange={(value) => updateField('department_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без отдела</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div>
                        <div className="font-medium">{dept.name}</div>
                        {dept.member_count !== undefined && (
                          <div className="text-xs text-slate-500">
                            {dept.member_count} участников
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Информация о приглашении */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-medium text-blue-800">
                Что произойдет после отправки:
              </h4>
            </div>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• На указанный email будет отправлено приглашение</li>
              <li>• Пользователь сможет принять или отклонить приглашение</li>
              <li>• После принятия получит доступ согласно выбранной роли</li>
              <li>• Вы получите уведомление о статусе приглашения</li>
            </ul>
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isSubmitting || !formData.email.trim() || !formData.role}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Отправка...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Отправить приглашение
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
