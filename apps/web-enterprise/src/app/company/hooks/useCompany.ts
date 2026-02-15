// hooks/useCompany.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/use-toast'
import {
  CompanyAPI,
  Company,
  CompanyStats,
  CompanySettings,
  Department,
} from '@/lib/api/company'
import type { TeamMember } from '@/lib/api/profile'

// ---- helpers ---------------------------------------------------------------
type ApiError = { response?: { data?: { detail?: string } }; message?: string }
const extractError = (err: unknown, fallback: string) => {
  const error = err as ApiError
  return error?.response?.data?.detail || error?.message || fallback
}

// Hook for company management
export const useCompany = () => {
  const [company, setCompany] = useState<Company | null>(null)
  const [stats, setStats] = useState<CompanyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Fetch company data
  const fetchCompany = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const companyData = await CompanyAPI.getCurrentCompany()
      if (mountedRef.current) setCompany(companyData)
    } catch (err: unknown) {
      const errorMessage = extractError(err, 'Failed to fetch company')
      if (mountedRef.current) {
        setError(errorMessage)
        console.error('Failed to fetch company:', err)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  // Fetch company statistics
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await CompanyAPI.getCompanyStats()
      if (mountedRef.current) setStats(statsData)
    } catch (err: unknown) {
      console.error('Failed to fetch company stats:', err)
    }
  }, [])

  // Update company
  const updateCompany = useCallback(
    async (updates: Partial<Company>): Promise<boolean> => {
      try {
        setUpdating(true)
        const updatedCompany = await CompanyAPI.updateCompany(updates)
        if (mountedRef.current) setCompany(updatedCompany)
        toast({
          title: 'Company Updated',
          description: 'Company information has been updated successfully',
        })
        // best-effort refresh of stats
        fetchStats()
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to update company')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      } finally {
        if (mountedRef.current) setUpdating(false)
      }
    },
    [toast, fetchStats]
  )

  // Create company (for new organizations)
  const createCompany = useCallback(
    async (companyData: {
      name: string
      description?: string
      website?: string
      industry?: string
      size?: string
    }): Promise<boolean> => {
      try {
        setUpdating(true)
        const newCompany = await CompanyAPI.createCompany(companyData)
        if (mountedRef.current) setCompany(newCompany)
        toast({ title: 'Company Created', description: 'Company has been created successfully' })
        // fetch initial stats for the new org
        fetchStats()
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to create company')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      } finally {
        if (mountedRef.current) setUpdating(false)
      }
    },
    [toast, fetchStats]
  )

  // Initialize
  useEffect(() => {
    // run both in parallel
    fetchCompany()
    fetchStats()
  }, [fetchCompany, fetchStats])

  const hasCompany = !!company?.id
  const refreshAll = useCallback(() => Promise.allSettled([fetchCompany(), fetchStats()]), [fetchCompany, fetchStats])

  return {
    company,
    stats,
    loading,
    updating,
    error,
    hasCompany,
    updateCompany,
    createCompany,
    refetch: fetchCompany,
    refetchStats: fetchStats,
    refreshAll,
  }
}

// Hook for department management
export const useDepartments = (orgId?: string) => {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Reset state when org changes
  useEffect(() => {
    setDepartments([])
    setError(null)
  }, [orgId])

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    if (!orgId) return
    try {
      setLoading(true)
      setError(null)
      const depts = await CompanyAPI.getDepartments(orgId)
      if (mountedRef.current) setDepartments(depts)
    } catch (err: unknown) {
      const errorMessage = extractError(err, 'Failed to fetch departments')
      if (mountedRef.current) {
        setError(errorMessage)
        console.error('Failed to fetch departments:', err)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [orgId])

  // Create department
  const createDepartment = useCallback(
    async (departmentData: {
      name: string
      description?: string
      parent_id?: string
      manager_id?: string
    }): Promise<boolean> => {
      if (!orgId) return false
      try {
        const newDept = await CompanyAPI.createDepartment(orgId, departmentData)
        if (mountedRef.current) setDepartments(prev => [...prev, newDept])
        toast({ title: 'Department Created', description: `Department "${newDept.name}" has been created` })
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to create department')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      }
    },
    [orgId, toast]
  )

  // Update department
  const updateDepartment = useCallback(
    async (
      deptId: string,
      updates: { name?: string; description?: string; manager_id?: string }
    ): Promise<boolean> => {
      if (!orgId) return false
      try {
        const updatedDept = await CompanyAPI.updateDepartment(orgId, deptId, updates)
        if (mountedRef.current)
          setDepartments(prev => prev.map(dept => (dept.id === deptId ? updatedDept : dept)))
        toast({ title: 'Department Updated', description: `Department "${updatedDept.name}" has been updated` })
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to update department')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      }
    },
    [orgId, toast]
  )

  // Delete department
  const deleteDepartment = useCallback(
    async (deptId: string, deptName: string): Promise<boolean> => {
      if (!orgId) return false
      try {
        await CompanyAPI.deleteDepartment(orgId, deptId)
        if (mountedRef.current) setDepartments(prev => prev.filter(dept => dept.id !== deptId))
        toast({ title: 'Department Deleted', description: `Department "${deptName}" has been deleted` })
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to delete department')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      }
    },
    [orgId, toast]
  )

  // Initialize
  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  return {
    departments,
    loading,
    error,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    refetch: fetchDepartments,
  }
}

// Hook for team management within company context
export const useCompanyTeam = (orgId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Clear state when org changes
  useEffect(() => {
    setTeamMembers([])
    setError(null)
  }, [orgId])

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    if (!orgId) return
    try {
      setLoading(true)
      setError(null)
      const members = await CompanyAPI.getTeamMembers(orgId)
      if (mountedRef.current) setTeamMembers(members)
    } catch (err: unknown) {
      const errorMessage = extractError(err, 'Failed to fetch team members')
      if (mountedRef.current) {
        setError(errorMessage)
        console.error('Failed to fetch team members:', err)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [orgId])

  // Invite employee
  const inviteEmployee = useCallback(
    async (email: string, role: string, departmentId?: string): Promise<boolean> => {
      if (!orgId) return false
      try {
        await CompanyAPI.inviteEmployee(orgId, email, role, departmentId)
        toast({ title: 'Invitation Sent', description: `Invitation sent to ${email}` })
        await fetchTeamMembers()
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to send invitation')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      }
    },
    [orgId, toast, fetchTeamMembers]
  )

  // Remove employee
  const removeEmployee = useCallback(
    async (membershipId: string, memberName: string): Promise<boolean> => {
      if (!orgId) return false
      try {
        await CompanyAPI.removeEmployee(orgId, membershipId)
        if (mountedRef.current) setTeamMembers(prev => prev.filter(member => member.id !== membershipId))
        toast({ title: 'Employee Removed', description: `${memberName} has been removed from the company` })
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to remove employee')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      }
    },
    [orgId, toast]
  )

  // Initialize
  useEffect(() => {
    fetchTeamMembers()
  }, [fetchTeamMembers])

  return {
    teamMembers,
    loading,
    error,
    inviteEmployee,
    removeEmployee,
    refetch: fetchTeamMembers,
  }
}

// Hook for company settings
export const useCompanySettings = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const { toast } = useToast()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const settingsData = await CompanyAPI.getCompanySettings()
      if (mountedRef.current) setSettings(settingsData)
    } catch (err: unknown) {
      console.error('Failed to fetch company settings:', err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  // Update settings
  const updateSettings = useCallback(
    async (updates: Partial<CompanySettings>): Promise<boolean> => {
      try {
        setUpdating(true)
        const updatedSettings = await CompanyAPI.updateCompanySettings(updates)
        if (mountedRef.current) setSettings(updatedSettings)
        toast({ title: 'Settings Updated', description: 'Company settings have been updated successfully' })
        return true
      } catch (err: unknown) {
        const errorMessage = extractError(err, 'Failed to update settings')
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        return false
      } finally {
        if (mountedRef.current) setUpdating(false)
      }
    },
    [toast]
  )

  // Initialize
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return {
    settings,
    loading,
    updating,
    updateSettings,
    refetch: fetchSettings,
  }
}
