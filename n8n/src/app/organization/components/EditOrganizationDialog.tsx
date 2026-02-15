// components/organization/EditOrganizationDialog.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Building2, AlertCircle } from "lucide-react";
import type { Organization } from "../hooks/useOrganization";

interface EditOrganizationDialogProps {
  organization: Organization;
  onOrganizationUpdated: (data: Partial<Organization>) => Promise<Organization>;
  trigger?: React.ReactNode;
}

interface EditFormData {
  name: string;
  description: string;
  industry: string;
  size: string;
  website: string;
  phone: string;
}

export function EditOrganizationDialog({ 
  organization, 
  onOrganizationUpdated,
  trigger 
}: EditOrganizationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<EditFormData>({
    name: "",
    description: "",
    industry: "",
    size: "",
    website: "",
    phone: ""
  });

  // Инициализация формы при открытии
  useEffect(() => {
    if (isOpen && organization) {
      setFormData({
        name: organization.name,
        description: organization.description || "",
        industry: organization.industry || "",
        size: organization.size || "",
        website:
          typeof organization.custom_fields?.website === "string"
            ? organization.custom_fields.website
            : "",
        phone:
          typeof organization.custom_fields?.phone === "string"
            ? organization.custom_fields.phone
            : "",
      });
      setValidationErrors({});
    }
  }, [isOpen, organization]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Название организации обязательно";
    } else if (formData.name.length > 150) {
      errors.name = "Название не может быть длиннее 150 символов";
    }

    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      errors.website = "Веб-сайт должен начинаться с http:// или https://";
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
      
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        industry: formData.industry || undefined,
        size: formData.size || undefined,
        custom_fields: {
          ...organization.custom_fields,
          website: formData.website.trim() || undefined,
          phone: formData.phone.trim() || undefined
        }
      };

      await onOrganizationUpdated(updateData);
      setIsOpen(false);
      
    } catch {
      // Ошибка уже обработана в хуке
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof EditFormData, value: string) => {
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
    setIsOpen(false);
    setValidationErrors({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Edit className="w-4 h-4 mr-2" />
            Редактировать
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Редактировать организацию
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-name" className="flex items-center gap-1">
                Название
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                maxLength={150}
                required
                className={validationErrors.name ? 'border-red-500' : ''}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validationErrors.name}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-industry">Индустрия</Label>
              <Select 
                value={formData.industry} 
                onValueChange={(value) => updateField('industry', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите индустрию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не указано</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                  <SelectItem value="marketing">Маркетинг</SelectItem>
                  <SelectItem value="retail">Ритейл</SelectItem>
                  <SelectItem value="education">Образование</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="edit-description">Описание</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Краткое описание организации"
            />
            <p className="text-xs text-slate-500 mt-1">
              {formData.description.length}/500 символов
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-website">Веб-сайт</Label>
              <Input
                id="edit-website"
                type="url"
                value={formData.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://example.com"
                className={validationErrors.website ? 'border-red-500' : ''}
              />
              {validationErrors.website && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validationErrors.website}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-phone">Телефон</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-size">Размер компании</Label>
            <Select 
              value={formData.size} 
              onValueChange={(value) => updateField('size', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите размер" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Не указано</SelectItem>
                <SelectItem value="small">Маленькая (до 50 сотрудников)</SelectItem>
                <SelectItem value="medium">Средняя (50-500 сотрудников)</SelectItem>
              </SelectContent>
            </Select>
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
                  Сохранение...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Сохранить изменения
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
