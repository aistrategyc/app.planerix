// components/tasks/TaskDetailDialog.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { TasksAPI, Task, TaskUpdate, TaskPriority, TaskType, TaskStatus, getTaskStatusOptions } from "@/lib/api/tasks"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, History, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface TaskDetailDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (taskId: string, updates: TaskUpdate) => Promise<Task | null>
  users: Array<{ id: string; username: string }>
  projects: Array<{ id: string; name: string }>
}

type TaskCommentUser = {
  username?: string
  email?: string
  [k: string]: unknown
}

type TaskComment = {
  id: string
  content: string
  created_at?: string
  user?: TaskCommentUser
  [k: string]: unknown
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  users,
  projects,
}: TaskDetailDialogProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [editedTask, setEditedTask] = useState<TaskUpdate>({})
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [newComment, setNewComment] = useState("")
  const getUserNameById = useCallback((userId?: string) => {
    if (!userId) return "Unknown User"
    const user = users.find(u => u.id === userId)
    return user?.username || "Unknown User"
  }, [users])

  // При открытии диалога заполняем поля из task
  useEffect(() => {
    if (task && open) {
      setEditedTask({
        title: task.title,
        description: task.description,
        priority: task.priority,
        task_type: task.task_type,
        status: task.status,
        assignee_id: task.assignee_id,
        project_id: task.project_id,
        due_date: task.due_date,
        estimated_hours: task.estimated_hours,
        actual_hours: task.actual_hours,
      })
    }
  }, [task, open])

  useEffect(() => {
    const fetchComments = async () => {
      if (!task || !open) return
      try {
        setCommentLoading(true)
        const data = await TasksAPI.getTaskComments(task.id)
        const items = Array.isArray(data) ? data : data?.items ?? []
        setComments(items as TaskComment[])
      } catch {
        toast({ title: "Error", description: "Failed to load comments", variant: "destructive" })
      } finally {
        setCommentLoading(false)
      }
    }

    fetchComments()
  }, [task, open, toast])

  const handleUpdate = useCallback(async () => {
    if (!task) return
    setIsUpdating(true)
    try {
      const updated = await onUpdate(task.id, editedTask)
      if (updated) {
        toast({ title: "Task Updated", description: "Changes saved successfully." })
        onOpenChange(false)
      }
    } catch {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }, [task, editedTask, onUpdate, toast, onOpenChange])

  const handleAddComment = useCallback(async () => {
    if (!task || !newComment.trim()) return
    try {
      const created = await TasksAPI.addTaskComment(task.id, newComment.trim())
      setComments((prev) => [created as TaskComment, ...prev])
      setNewComment("")
    } catch {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" })
    }
  }, [task, newComment, toast])

  const getStatusColor = (status: TaskStatus) => {
    const map = {
      todo: "bg-slate-100 text-slate-800",
      in_progress: "bg-blue-100 text-blue-800",
      in_review: "bg-yellow-100 text-yellow-800",
      blocked: "bg-orange-100 text-orange-800",
      done: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return map[status] || ""
  }

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Task Details
            <Badge className={getStatusColor(task.status)} variant="outline">
              {task.status.replace("_", " ").toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>View and update this task</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* MAIN CONTENT */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={editedTask.title || ""}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={editedTask.description || ""}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Status */}
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editedTask.status || task.status}
                  onValueChange={(value) =>
                    setEditedTask({ ...editedTask, status: value as TaskStatus })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getTaskStatusOptions(task.status).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ").toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={editedTask.priority || task.priority}
                  onValueChange={(value) =>
                    setEditedTask({ ...editedTask, priority: value as TaskPriority })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskPriority).map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={editedTask.task_type || task.task_type}
                  onValueChange={(value) =>
                    setEditedTask({ ...editedTask, task_type: value as TaskType })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Assignee */}
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Select
                  value={editedTask.assignee_id ?? task.assignee_id ?? ""}
                  onValueChange={(value) =>
                    setEditedTask({ ...editedTask, assignee_id: value || undefined })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project */}
              <div className="grid gap-2">
                <Label>Project</Label>
                <Select
                  value={editedTask.project_id ?? task.project_id ?? ""}
                  onValueChange={(value) =>
                    setEditedTask({ ...editedTask, project_id: value || undefined })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="No Project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates and Hours */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editedTask.due_date || ""}
                  onChange={(e) =>
                    setEditedTask({ ...editedTask, due_date: e.target.value || undefined })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Estimated Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editedTask.estimated_hours !== undefined ? String(editedTask.estimated_hours) : ""}
                  onChange={(e) =>
                    setEditedTask({
                      ...editedTask,
                      estimated_hours: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Actual Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editedTask.actual_hours !== undefined ? String(editedTask.actual_hours) : ""}
                  onChange={(e) =>
                    setEditedTask({
                      ...editedTask,
                      actual_hours: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Created: {new Date(task.created_at).toLocaleString()}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Updated: {new Date(task.updated_at).toLocaleString()}</div>
              </div>
              <div className="space-y-2">
                <div>Task ID: {task.id}</div>
                <div>Created by: {getUserNameById(task.creator_id)}</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <div className="grid gap-2">
              <Label>Add Comment</Label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                  Add Comment
                </Button>
              </div>
            </div>

            {commentLoading ? (
              <div className="text-center text-muted-foreground">Loading comments...</div>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="border rounded-lg p-3">
                    <div className="text-sm font-medium">
                      {comment.user?.username || comment.user?.email || "User"}
                    </div>
                    <div className="text-sm text-muted-foreground">{comment.content}</div>
                    {typeof comment.created_at === "string" && comment.created_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(comment.created_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">No comments yet.</div>
            )}
          </TabsContent>

          <TabsContent value="history" className="py-6 text-center text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-2" />
            History coming soon...
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
