import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { OKRsAPI, type OKR, type OKRCreate, type OKRUpdate } from '@/lib/api/okr'

export const useOkrs = () => {
  const [okrs, setOkrs] = useState<OKR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchOkrs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await OKRsAPI.list()
      setOkrs(data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const errorMessage = error.response?.data?.detail || 'Failed to fetch OKRs'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const createOkr = useCallback(async (data: OKRCreate): Promise<OKR | null> => {
    try {
      const newOkr = await OKRsAPI.create(data)
      setOkrs(prev => [newOkr, ...prev])
      toast({
        title: 'OKR Created',
        description: `OKR "${newOkr.title}" has been created successfully`,
      })
      return newOkr
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const errorMessage = error.response?.data?.detail || 'Failed to create OKR'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }, [toast])

  const updateOkr = useCallback(async (id: string, data: OKRUpdate): Promise<OKR | null> => {
    try {
      const updatedOkr = await OKRsAPI.update(id, data)
      setOkrs(prev => prev.map(okr => okr.id === id ? updatedOkr : okr))
      toast({
        title: 'OKR Updated',
        description: `OKR has been updated successfully`,
      })
      return updatedOkr
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const errorMessage = error.response?.data?.detail || 'Failed to update OKR'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }, [toast])

  const deleteOkr = useCallback(async (id: string): Promise<boolean> => {
    try {
      await OKRsAPI.delete(id)
      setOkrs(prev => prev.filter(okr => okr.id !== id))
      toast({
        title: 'OKR Deleted',
        description: 'OKR has been deleted successfully',
      })
      return true
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const errorMessage = error.response?.data?.detail || 'Failed to delete OKR'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }, [toast])

  useEffect(() => {
    fetchOkrs()
  }, [fetchOkrs])

  return {
    okrs,
    loading,
    error,
    createOkr,
    updateOkr,
    deleteOkr,
    loadOkrs: fetchOkrs,
    refetch: fetchOkrs,
  }
}
