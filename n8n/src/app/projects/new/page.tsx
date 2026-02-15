"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { ProjectsAPI, ProjectPriority, ProjectStatus } from "@/lib/api/projects"
import { OKRsAPI, type OKR } from "@/lib/api/okr"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { PageHeader } from "@/components/layout/PageHeader"

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Name too long"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["draft", "active", "on_hold", "completed", "cancelled", "archived"]),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.string().optional(),
  objective_id: z.string().optional(),
})

type CreateProjectForm = z.infer<typeof createProjectSchema>

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [objectives, setObjectives] = useState<OKR[]>([])
  const [objectivesLoading, setObjectivesLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      priority: "medium",
      status: "draft"
    }
  })
  const objectiveId = watch("objective_id")

  useEffect(() => {
    let active = true
    const loadObjectives = async () => {
      setObjectivesLoading(true)
      try {
        const items = await OKRsAPI.list({ page: 1, page_size: 100 })
        if (active) setObjectives(items)
      } catch (err) {
        console.error("Failed to load objectives:", err)
      } finally {
        if (active) setObjectivesLoading(false)
      }
    }
    loadObjectives()
    return () => {
      active = false
    }
  }, [])

  const onSubmit = async (data: CreateProjectForm) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    try {
      const project = await ProjectsAPI.create({
        ...data,
        budget: data.budget ? parseFloat(data.budget) : undefined,
        priority: data.priority as ProjectPriority,
        status: data.status as ProjectStatus,
        objective_id: data.objective_id || undefined,
      })

      toast({
        title: "Success",
        description: "Project created successfully",
      })

      router.push(`/projects/${project.id}`)
    } catch (err) {
      console.error("Project creation failed:", err)
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Project"
        description="Set up a new project to organize your tasks and team collaboration."
        actions={(
          <Button variant="ghost" asChild>
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to projects
            </Link>
          </Button>
        )}
      />

      <div className="max-w-3xl">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Project details</CardTitle>
            <CardDescription>
              Define the scope, timeline, and ownership before launching.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  {...register("name")}
                  id="name"
                  placeholder="Enter project name"
                  className={errors.name && "border-destructive"}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  {...register("description")}
                  id="description"
                  placeholder="Describe your project..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select onValueChange={(value) => setValue("priority", value as CreateProjectForm["priority"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select onValueChange={(value) => setValue("status", value as CreateProjectForm["status"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective_id">Linked Objective</Label>
                <Select
                  value={objectiveId || ""}
                  onValueChange={(value) => setValue("objective_id", value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={objectivesLoading ? "Loading objectives..." : "Select objective (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No objective</SelectItem>
                    {objectives.map((objective) => (
                      <SelectItem key={objective.id} value={objective.id}>
                        {objective.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    {...register("start_date")}
                    id="start_date"
                    type="date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    {...register("end_date")}
                    id="end_date"
                    type="date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget</Label>
                <Input
                  {...register("budget")}
                  id="budget"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className="flex-1"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
