// src/app/organization/hooks/useOrganization.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useOrganizationApi } from './useApi';

// Типы данных
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  size?: string;
  owner_id: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    country?: string;
    postal_code?: string;
  };
  preferences?: {
    timezone?: string;
    currency?: string;
    locale?: string;
    week_start?: string;
  };
  custom_fields?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  user: {
    id: string;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  role: string;
  status: string;
  department?: {
    id: string;
    name: string;
  };
  joined_at: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  member_count?: number;
  created_at: string;
}

export interface OrganizationStats {
  totalMembers: number;
  totalDepartments: number;
  activeMembers: number;
  pendingMembers: number;
  activeProjects: number;
  monthlyGrowth: number;
}

type OrganizationAnalytics = Record<string, unknown>;

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object') {
    const candidate = err as { message?: unknown }
    if (typeof candidate.message === 'string') {
      return candidate.message
    }
  }
  return fallback
}

// Базовый хук для API состояния
function useApiState<T>(initialState: T) {
  const [data, setData] = useState<T>(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateData = useCallback((newData: T) => {
    setData(newData);
  }, []);

  const setLoadingState = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  const setErrorState = useCallback((errorMessage: string | null) => {
    setError(errorMessage);
  }, []);

  return {
    data,
    loading,
    error,
    updateData,
    setLoadingState,
    setErrorState
  };
}

// Хук для работы с организацией
export function useOrganization(orgId: string) {
  const { 
    data: organization, 
    loading, 
    error, 
    updateData, 
    setLoadingState, 
    setErrorState 
  } = useApiState<Organization | null>(null);
  
  const { toast } = useToast();
  const api = useOrganizationApi();

  const loadOrganization = useCallback(async (force = false) => {
    if (!orgId) return;

    try {
      setLoadingState(true);
      setErrorState(null);

      const data = await api.getOrganization(orgId) as Organization;
      updateData(data);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось загрузить организацию');
      setErrorState(errorMessage);
      if (force) {
        toast({ title: "Ошибка", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setLoadingState(false);
    }
  }, [orgId, updateData, setLoadingState, setErrorState, toast, api]);

  const updateOrganization = useCallback(async (payload: Partial<Organization>): Promise<Organization> => {
    if (!orgId) throw new Error('Organization ID is required');
    let updated: Organization;

    try {
      updated = await api.updateOrganization(orgId, payload) as Organization;
      updateData(updated);
      
      toast({
        title: "Успешно",
        description: "Данные организации обновлены"
      });
      
      return updated;
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось обновить организацию');
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [orgId, organization, updateData, toast, api]);

  useEffect(() => {
    loadOrganization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return {
    organization,
    loading,
    error,
    updateOrganization,
    refetch: useCallback(() => loadOrganization(true), [loadOrganization])
  };
}

// Хук для работы с участниками
export function useOrganizationMembers(orgId: string) {
  const { 
    data: members, 
    loading, 
    error, 
    updateData, 
    setLoadingState, 
    setErrorState 
  } = useApiState<Member[]>([]);
  
  const { toast } = useToast();
  const api = useOrganizationApi();

  const loadMembers = useCallback(async (force = false) => {
    if (!orgId) return;
    try {
      setLoadingState(true);
      setErrorState(null);
      const data = await api.getMembers(orgId) as { items?: Member[] } | Member[];
      const membersList = Array.isArray(data) ? data : (data.items || []);
      updateData(membersList);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось загрузить участников');
      setErrorState(errorMessage);
      if (force) {
        toast({ title: "Ошибка", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setLoadingState(false);
    }
  }, [orgId, updateData, setLoadingState, setErrorState, toast, api]);

  const inviteMember = useCallback(async (inviteData: { 
    email: string; 
    role: string; 
    department_id?: string 
  }) => {
    if (!orgId) throw new Error('Organization ID is required');

    try {
      await api.createInvite(orgId, inviteData);
      
      toast({
        title: "Приглашение отправлено",
        description: `Приглашение отправлено на ${inviteData.email}`
      });
      
      // Перезагружаем список участников
      await loadMembers(true);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось отправить приглашение');
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [orgId, loadMembers, toast, api]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!orgId) throw new Error('Organization ID is required');

    try {
      await api.removeMember(orgId, memberId);
      
      // Оптимистичное удаление из списка
      updateData(members.filter(m => m.id !== memberId));
      
      toast({
        title: "Участник удален",
        description: "Участник успешно удален из организации"
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось удалить участника');
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Перезагружаем список при ошибке
      await loadMembers(true);
      throw err;
    }
  }, [orgId, members, updateData, loadMembers, toast, api]);

  const updateMemberRole = useCallback(async (memberId: string, newRole: string) => {
    if (!orgId) throw new Error('Organization ID is required');

    try {
      await api.updateMemberRole(orgId, memberId, newRole);
      
      // Оптимистичное обновление
      updateData(members.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));
      
      toast({
        title: "Роль обновлена",
        description: "Роль участника успешно изменена"
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось обновить роль');
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Перезагружаем список при ошибке
      await loadMembers(true);
      throw err;
    }
  }, [orgId, members, updateData, loadMembers, toast, api]);

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return {
    members,
    loading,
    error,
    inviteMember,
    removeMember,
    updateMemberRole,
    refetch: useCallback(() => loadMembers(true), [loadMembers])
  };
}

// Хук для работы с отделами
export function useOrganizationDepartments(orgId: string) {
  const { 
    data: departments, 
    loading, 
    error, 
    updateData, 
    setLoadingState, 
    setErrorState 
  } = useApiState<Department[]>([]);
  
  const { toast } = useToast();
  const api = useOrganizationApi();

  const loadDepartments = useCallback(async (force = false) => {
    if (!orgId) return;
    try {
      setLoadingState(true);
      setErrorState(null);
      const data = await api.getDepartments(orgId) as Department[];
      updateData(data);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось загрузить отделы');
      setErrorState(errorMessage);
      if (force) {
        toast({ title: "Ошибка", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setLoadingState(false);
    }
  }, [orgId, updateData, setLoadingState, setErrorState, toast, api]);

  const createDepartment = useCallback(async (departmentData: { 
    name: string; 
    description?: string;
    manager_id?: string;
  }) => {
    if (!orgId) throw new Error('Organization ID is required');

    try {
      const newDepartment = await api.createDepartment(orgId, departmentData) as Department;
      
      // Оптимистичное добавление в список
      updateData([...departments, newDepartment]);
      
      toast({
        title: "Отдел создан",
        description: `Отдел "${departmentData.name}" успешно создан`
      });
      
      return newDepartment;
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось создать отдел');
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [orgId, departments, updateData, toast, api]);

  const updateDepartment = useCallback(async (
    departmentId: string,
    patch: Partial<Department>
  ) => {
    if (!orgId) throw new Error('Organization ID is required');

    try {
      const updated = await api.updateDepartment(orgId, departmentId, patch) as Department;
      
      // Оптимистичное обновление
      updateData(departments.map(d => (d.id === departmentId ? updated : d)));
      
      toast({
        title: "Отдел обновлен",
        description: "Данные отдела успешно обновлены"
      });
      
      return updated;
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось обновить отдел');
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [orgId, departments, updateData, toast, api]);

  const deleteDepartment = useCallback(async (departmentId: string) => {
    if (!orgId) throw new Error('Organization ID is required');

    try {
      await api.deleteDepartment(orgId, departmentId);
      
      // Оптимистичное удаление из списка
      updateData(departments.filter(d => d.id !== departmentId));
      
      toast({
        title: "Отдел удален",
        description: "Отдел успешно удален"
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось удалить отдел');
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Перезагружаем список при ошибке
      await loadDepartments(true);
      throw err;
    }
  }, [orgId, departments, updateData, loadDepartments, toast, api]);

  useEffect(() => {
    loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return {
    departments,
    loading,
    error,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    refetch: useCallback(() => loadDepartments(true), [loadDepartments])
  };
}

// Комплексный хук для управления всеми данными организации
export function useOrganizationData(orgId: string) {
  const organization = useOrganization(orgId);
  const members = useOrganizationMembers(orgId);
  const departments = useOrganizationDepartments(orgId);

  // Мемоизированная статистика
  const stats = useMemo((): OrganizationStats => {
    const activeMembers = members.members.filter(m => m.status === 'active');
    const pendingMembers = members.members.filter(m => m.status === 'pending');

    return {
      totalMembers: members.members.length,
      totalDepartments: departments.departments.length,
      activeMembers: activeMembers.length,
      pendingMembers: pendingMembers.length,
      activeProjects: 0,
      monthlyGrowth: 0
    };
  }, [members.members, departments.departments]);

  const isLoading = organization.loading || members.loading || departments.loading;
  const hasError = organization.error || members.error || departments.error;

  // Комплексное обновление всех данных
  const refetchAll = useCallback(async () => {
    await Promise.all([
      organization.refetch(),
      members.refetch(),
      departments.refetch()
    ]);
  }, [organization.refetch, members.refetch, departments.refetch]);

  // Интеллектуальная функция обновления
  const smartRefetch = useCallback(async (entities: ('organization' | 'members' | 'departments')[]) => {
    const promises = [];
    
    if (entities.includes('organization')) {
      promises.push(organization.refetch());
    }
    if (entities.includes('members')) {
      promises.push(members.refetch());
    }
    if (entities.includes('departments')) {
      promises.push(departments.refetch());
    }
    
    await Promise.all(promises);
  }, [organization.refetch, members.refetch, departments.refetch]);

  return {
    organization: organization.organization,
    members: members.members,
    departments: departments.departments,
    stats,
    loading: isLoading,
    error: hasError,
    actions: {
      // Организация
      updateOrganization: organization.updateOrganization,
      
      // Участники
      inviteMember: members.inviteMember,
      removeMember: members.removeMember,
      updateMemberRole: members.updateMemberRole,
      
      // Отделы
      createDepartment: departments.createDepartment,
      updateDepartment: departments.updateDepartment,
      deleteDepartment: departments.deleteDepartment,
      
      // Общие действия
      refetchAll,
      smartRefetch
    }
  };
}

// Хук для аналитики организации
export function useOrganizationAnalytics(orgId: string, timeRange = '30d') {
  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useOrganizationApi();

  const loadAnalytics = useCallback(async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = (await api.getAnalytics(orgId, timeRange)) as OrganizationAnalytics;
      setAnalytics(data);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Не удалось загрузить аналитику');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [orgId, timeRange, api]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    loading,
    error,
    refetch: loadAnalytics
  };
}
