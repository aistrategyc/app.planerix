// hooks/useTasks.ts
import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { TasksAPI, UsersAPI, Task, TaskCreate, TaskUpdate, TaskStatus, TaskFilters, User, TaskStats } from '@/lib/api/tasks'
import { ProjectsAPI, type Project } from '@/lib/api/projects'
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object') {
    const candidate = err as { response?: { data?: { detail?: unknown } }; message?: unknown }
    const detail = candidate.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (typeof candidate.message === 'string') return candidate.message
  }
  return fallback
}

// Hook for managing tasks
export const useTasks = (initialFilters?: TaskFilters) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TaskFilters>(initialFilters || {})
  const { toast } = useToast()

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedTasks = await TasksAPI.getTasks(filters)
      setTasks(fetchedTasks)
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to fetch tasks')
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filters, toast])

  // Create task
  const createTask = useCallback(async (taskData: TaskCreate): Promise<Task | null> => {
    try {
      const newTask = await TasksAPI.createTask(taskData)
      setTasks(prev => [newTask, ...prev])
      toast({
        title: 'Task Created',
        description: `Task "${newTask.title}" has been created successfully`,
      })
      return newTask
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create task')
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }, [toast])

  // Update task
  const updateTask = useCallback(async (taskId: string, taskData: TaskUpdate): Promise<Task | null> => {
    try {
      const updatedTask = await TasksAPI.updateTask(taskId, taskData)
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      toast({
        title: 'Task Updated',
        description: `Task "${updatedTask.title}" has been updated`,
      })
      return updatedTask
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to update task')
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }, [toast])

  // Update task status (for drag & drop)
  const updateTaskStatus = useCallback(async (taskId: string, newStatus: TaskStatus): Promise<boolean> => {
    try {
      const updatedTask = await TasksAPI.updateTaskStatus(taskId, newStatus)
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      toast({
        title: 'Task Moved',
        description: `Task moved to ${newStatus.replace('_', ' ')}`,
      })
      return true
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to update task status')
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }, [toast])

  // Delete task
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      await TasksAPI.deleteTask(taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
      toast({
        title: 'Task Deleted',
        description: 'Task has been deleted successfully',
      })
      return true
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to delete task')
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }, [toast])

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<TaskFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return {
    tasks,
    loading,
    error,
    filters,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    updateFilters,
    refetch: fetchTasks,
  }
}

// Hook for managing users (for assignee dropdown)
export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const fetchedUsers = await UsersAPI.getUsers()
      setUsers(fetchedUsers)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch users'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return { users, loading, error, refetch: fetchUsers }
}

// Hook for managing projects
export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const fetchedProjects = await ProjectsAPI.list()
      setProjects(fetchedProjects.items ?? [])
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch projects'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return { projects, loading, error, refetch: fetchProjects }
}

// Hook for task statistics
export const useTaskStats = () => {
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fetched = await TasksAPI.getTaskStats()
      setStats(fetched)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch stats'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()        // 👈 просто вызываем подготовленный метод
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}
