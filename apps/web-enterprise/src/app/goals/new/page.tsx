"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { OKRsAPI, ObjectiveStatus } from "@/lib/api/okr"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, AlertCircle, Loader2, Target } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

const createGoalSchema = z.object({
  title: z.string().min(1, "Goal title is required").max(200, "Title too long"),
  description: z.string().optional(),
  timeframe: z.enum(["monthly", "quarterly", "yearly", "custom"]),
  target_date: z.string().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]),
})

type CreateGoalForm = z.infer<typeof createGoalSchema>

export default function NewGoalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch
  } = useForm<CreateGoalForm>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      timeframe: "quarterly",
      status: "active"
    }
  })

  const timeframe = watch("timeframe")

  const computeDueDate = (timeframeValue: CreateGoalForm["timeframe"], targetDate?: string) => {
    if (timeframeValue === "custom") return targetDate || undefined
    const base = new Date()
    const days = timeframeValue === "monthly" ? 30 : timeframeValue === "quarterly" ? 90 : 365
    const due = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
    return due.toISOString().split("T")[0]
  }

  const onSubmit = async (data: CreateGoalForm) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    try {
      const startDate = new Date().toISOString().split("T")[0]
      const dueDate = computeDueDate(data.timeframe, data.target_date)
      const payload = {
        title: data.title,
        description: data.description,
        status: data.status as ObjectiveStatus,
        start_date: startDate,
        due_date: dueDate,
      }

      await OKRsAPI.create(payload)

      toast({
        title: "Success",
        description: "Goal created successfully",
      })

      router.push(`/goals`)
    } catch (err) {
      console.error("Goal creation failed:", err)
      setError(err instanceof Error ? err.message : "Failed to create goal")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/goals"
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors inline-flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to goals
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle>Create New Goal</CardTitle>
            </div>
            <CardDescription>
              Define a new objective to track progress and achieve success
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
                <Label htmlFor="title">Goal Title *</Label>
                <Input
                  {...register("title")}
                  id="title"
                  placeholder="Enter your goal (e.g., Increase revenue by 25%)"
                  className={errors.title && "border-destructive"}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  {...register("description")}
                  id="description"
                  placeholder="Describe your goal in detail, including key results and success metrics..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Include specific, measurable outcomes that will indicate success
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Timeframe</Label>
                  <Select onValueChange={(value) => setValue("timeframe", value as CreateGoalForm["timeframe"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                      <SelectItem value="quarterly">Quarterly (90 days)</SelectItem>
                      <SelectItem value="yearly">Yearly (365 days)</SelectItem>
                      <SelectItem value="custom">Custom Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select onValueChange={(value) => setValue("status", value as CreateGoalForm["status"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {timeframe === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="target_date">Target Date</Label>
                  <Input
                    {...register("target_date")}
                    id="target_date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">💡 Tips for Effective Goals</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Make goals specific and measurable</li>
                  <li>• Set achievable but challenging targets</li>
                  <li>• Include 3-5 key results per objective</li>
                  <li>• Review and update progress regularly</li>
                </ul>
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
                  {isSubmitting ? "Creating..." : "Create Goal"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
