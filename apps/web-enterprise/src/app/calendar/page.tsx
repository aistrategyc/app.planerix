"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Calendar, Views, dateFnsLocalizer } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import { enUS } from "date-fns/locale"
import "react-big-calendar/lib/css/react-big-calendar.css"

import { useCalendar, useUpcomingDeadlines, useOverdueEvents, useEventFilters } from "@/app/calendar/hooks/useCalendar"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { CalendarEvent, EventType, EventStatus, CreateEventRequest } from "@/lib/api/calendar"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { EmptyState } from "@/components/ui/empty-state"
import { PageLoader } from "@/components/ui/loading-spinner"

import {
  Plus,
  Search,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit3,
  Trash2
} from "lucide-react"

// Calendar localization
const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.MEETING]: "Meeting",
  [EventType.TASK_DEADLINE]: "Task Deadline",
  [EventType.PROJECT_MILESTONE]: "Milestone",
  [EventType.OKR_REVIEW]: "OKR Review",
  [EventType.PERSONAL]: "Personal",
  [EventType.HOLIDAY]: "Holiday",
  [EventType.VACATION]: "Vacation",
  [EventType.OTHER]: "Other",
}

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  [EventStatus.CONFIRMED]: "Confirmed",
  [EventStatus.TENTATIVE]: "Tentative",
  [EventStatus.CANCELLED]: "Cancelled",
  [EventStatus.COMPLETED]: "Completed",
}

const EVENT_TONES: Record<EventType, { bg: string; border: string; badge: string; dot: string }> = {
  [EventType.MEETING]: { bg: "bg-blue-600/90", border: "border border-blue-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
  [EventType.TASK_DEADLINE]: { bg: "bg-amber-600/90", border: "border border-amber-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
  [EventType.PROJECT_MILESTONE]: { bg: "bg-indigo-600/90", border: "border border-indigo-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
  [EventType.OKR_REVIEW]: { bg: "bg-teal-600/90", border: "border border-teal-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
  [EventType.PERSONAL]: { bg: "bg-slate-600/90", border: "border border-slate-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
  [EventType.HOLIDAY]: { bg: "bg-rose-600/90", border: "border border-rose-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
  [EventType.VACATION]: { bg: "bg-sky-600/90", border: "border border-sky-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
  [EventType.OTHER]: { bg: "bg-gray-600/90", border: "border border-gray-700/60", badge: "bg-white/15 text-white", dot: "bg-white" },
}

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <CalendarPageContent />
    </ProtectedRoute>
  )
}

function CalendarPageContent() {
  const { toast } = useToast()

  const { events, loading, createEvent, deleteEvent, updateEventStatus, bootstrapRituals } = useCalendar()
  const { deadlines } = useUpcomingDeadlines(7)
  const { overdueEvents } = useOverdueEvents()
  const {
    filteredEvents,
    searchQuery,
    setSearchQuery
  } = useEventFilters(events)

  const [view, setView] = useState<typeof Views[keyof typeof Views]>(Views.MONTH)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const createParam = searchParams.get("create")

  useEffect(() => {
    if (createParam === "1") {
      setShowCreateDialog(true)
      router.replace("/calendar")
    }
  }, [createParam, router])
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(false)

  const [newEvent, setNewEvent] = useState<CreateEventRequest>({
    title: "",
    start_date: "",
    end_date: "",
    event_type: EventType.MEETING,
    description: "",
    is_all_day: true
  })

  type CalendarUIEvent = CalendarEvent & { start: Date; end: Date }

  const upcomingEvents = useMemo(() => {
    const items = [...filteredEvents]
    items.sort((a, b) => {
      const aTime = new Date(a.start_date).getTime()
      const bTime = new Date(b.start_date).getTime()
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0
      return aTime - bTime
    })
    return items.slice(0, 6)
  }, [filteredEvents])

  const handleCreateEvent = useCallback(async () => {
    if (!newEvent.title.trim() || !newEvent.start_date || !newEvent.end_date) {
      toast({ title: 'Validation Error', description: 'Fill all required fields', variant: 'destructive' })
      return
    }

    setIsCreating(true)
    const created = await createEvent(newEvent)

    if (created) {
      setNewEvent({
        title: "",
        start_date: "",
        end_date: "",
        event_type: EventType.MEETING,
        description: "",
        is_all_day: true
      })
      setShowCreateDialog(false)
    }

    setIsCreating(false)
  }, [newEvent, createEvent, toast])

  const handleBootstrapRituals = useCallback(async () => {
    setIsBootstrapping(true)
    await bootstrapRituals()
    setIsBootstrapping(false)
  }, [bootstrapRituals])

  const getStatusIcon = (status: EventStatus) => {
    switch (status) {
      case EventStatus.COMPLETED:
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case EventStatus.CONFIRMED:
        return <Clock className="w-4 h-4 text-blue-600" />
      case EventStatus.CANCELLED:
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <CalendarIcon className="w-4 h-4 text-slate-600" />
    }
  }

  const getEventTone = (event: CalendarEvent) => {
    if (event.status === EventStatus.CANCELLED) {
      return {
        bg: "bg-slate-500/80",
        border: "border border-slate-600/60",
        badge: "bg-white/15 text-white/80",
        dot: "bg-white/70",
        titleClass: "line-through text-white/80",
      }
    }
    if (event.status === EventStatus.COMPLETED) {
      return {
        bg: "bg-emerald-600/90",
        border: "border border-emerald-700/60",
        badge: "bg-white/15 text-white",
        dot: "bg-white",
        titleClass: "text-white/95",
      }
    }
    const tone = EVENT_TONES[event.event_type] || EVENT_TONES[EventType.OTHER]
    return { ...tone, titleClass: "text-white" }
  }

  const formatEventTime = (event: CalendarEvent) => {
    if (event.is_all_day) return "All day"
    const start = format(new Date(event.start_date), "HH:mm")
    const end = format(new Date(event.end_date), "HH:mm")
    return `${start}–${end}`
  }

  const formatEventDate = (value?: string | null) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return format(date, "MMM d, yyyy")
  }

  const getEventTypeLabel = (event: CalendarEvent) =>
    EVENT_TYPE_LABELS[event.event_type] || "Event"

  const getEventStatusLabel = (event: CalendarEvent) =>
    EVENT_STATUS_LABELS[event.status] || "Status"

  const deleteEventHandler = useCallback(async (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      const event = events.find(e => e.id === eventId)
      await deleteEvent(eventId, event?.title || 'Event')
      setShowEventDialog(false)
    }
  }, [deleteEvent, events])

  if (loading) {
    return <PageLoader text="Загрузка календаря..." />
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Calendar</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            One schedule for milestones, deadlines, and team rituals.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          
          <Select value={view} onValueChange={(v: typeof view) => setView(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={Views.MONTH}>Month</SelectItem>
              <SelectItem value={Views.WEEK}>Week</SelectItem>
              <SelectItem value={Views.DAY}>Day</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleBootstrapRituals} disabled={isBootstrapping}>
            {isBootstrapping ? "Updating rituals..." : "Generate rituals"}
          </Button>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>Add a new event to your calendar</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Event title..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Event description..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start">Start Date</Label>
                    <Input
                      id="start"
                      type="datetime-local"
                      value={newEvent.start_date}
                      onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end">End Date</Label>
                    <Input
                      id="end"
                      type="datetime-local"
                      value={newEvent.end_date}
                      onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={newEvent.event_type}
                      onValueChange={(value) => setNewEvent({ ...newEvent, event_type: value as EventType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EventType.MEETING}>Meeting</SelectItem>
                        <SelectItem value={EventType.TASK_DEADLINE}>Task Deadline</SelectItem>
                        <SelectItem value={EventType.PROJECT_MILESTONE}>Project Milestone</SelectItem>
                        <SelectItem value={EventType.OKR_REVIEW}>OKR Review</SelectItem>
                        <SelectItem value={EventType.PERSONAL}>Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateEvent} disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{deadlines.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{overdueEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">
                  {events.filter(e => e.status === EventStatus.COMPLETED).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Calendar */}
      <Card className="bg-card/40 border-border/60 shadow-sm">
        <CardContent className="p-6">
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title="Пока нет событий"
              description="Создайте первое событие или подключите интеграции, чтобы наполнить календарь."
              action={{
                label: "Создать событие",
                onClick: () => setShowCreateDialog(true),
              }}
            />
          ) : (
            <Calendar
              localizer={localizer}
              events={filteredEvents.map(event => ({
                ...event,
                start: new Date(event.start_date),
                end: new Date(event.end_date),
              }))}
              startAccessor="start"
              endAccessor="end"
              views={[Views.MONTH, Views.WEEK, Views.DAY]}
              view={view}
              onView={setView}
              style={{ height: 600 }}
              eventPropGetter={(event: CalendarUIEvent) => {
                return {
                  style: {
                    backgroundColor: 'transparent',
                    color: 'inherit',
                    borderRadius: '6px',
                    border: 'none',
                    padding: 0,
                    boxShadow: 'none',
                  }
                }
              }}
              components={{
                event: ({ event }: { event: CalendarUIEvent }) => (
                  (() => {
                    const tone = getEventTone(event)
                    const typeLabel = getEventTypeLabel(event)
                    const statusLabel = getEventStatusLabel(event)
                    const timeLabel = formatEventTime(event)
                    return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`cursor-pointer rounded-md px-2 py-1 text-[11px] leading-tight shadow-sm ${tone.bg} ${tone.border}`}
                          onClick={() => {
                            setSelectedEvent(event)
                            setShowEventDialog(true)
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                              <span className={`truncate font-semibold ${tone.titleClass}`}>{event.title}</span>
                            </div>
                            {event.is_important && (
                              <AlertTriangle className="h-3 w-3 text-amber-200" />
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/90">
                            <span className="truncate">{timeLabel}</span>
                            <span className={`rounded-full px-1.5 py-0.5 ${tone.badge}`}>{typeLabel}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-white/70">{statusLabel}</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-xs">{typeLabel}</p>
                          <p className="text-xs text-muted-foreground">{timeLabel}</p>
                          <p className="text-xs text-muted-foreground">{statusLabel}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                    )
                  })()
                )
              }}
            />
          )}
        </CardContent>
      </Card>

      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {upcomingEvents.map((event) => {
              const tone = getEventTone(event)
              const typeLabel = getEventTypeLabel(event)
              const statusLabel = getEventStatusLabel(event)
              return (
                <div key={event.id} className={`rounded-lg p-4 ${tone.bg} ${tone.border} text-white`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                      <span className={`truncate font-semibold ${tone.titleClass}`}>{event.title}</span>
                    </div>
                    <Badge className={`${tone.badge} uppercase text-[10px]`}>{typeLabel}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-white/80">
                    {formatEventDate(event.start_date)} • {formatEventTime(event)}
                  </div>
                  {event.description && (
                    <p className="mt-2 text-sm text-white/90 line-clamp-2">{event.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/80">
                    <span>Status: {statusLabel}</span>
                    {event.location && <span>• {event.location}</span>}
                    {event.project_id && <span>• Project linked</span>}
                    {event.task_id && <span>• Task linked</span>}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Deadlines Sidebar */}
      {deadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deadlines.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center gap-2 p-2 border rounded-lg">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: event.color || '#3b82f6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.start_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {event.event_type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Detail Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedEvent.status ? getStatusIcon(selectedEvent.status as EventStatus) : <CalendarIcon className="w-4 h-4 text-slate-600" />}
                  {selectedEvent.title}
                  {selectedEvent.is_important && (
                    <Badge variant="outline">
                      Important
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {getEventTypeLabel(selectedEvent)} • {new Date(selectedEvent.start_date).toLocaleString()} - {new Date(selectedEvent.end_date).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  {selectedEvent.description && (
                    <div>
                      <Label>Description</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedEvent.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start</Label>
                      <p className="text-sm">{new Date(selectedEvent.start_date).toLocaleString()}</p>
                    </div>
                    <div>
                      <Label>End</Label>
                      <p className="text-sm">{new Date(selectedEvent.end_date).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <p className="text-sm">{getEventTypeLabel(selectedEvent)}</p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <p className="text-sm">{getEventStatusLabel(selectedEvent)}</p>
                    </div>
                  </div>

                  {(selectedEvent.task_id || selectedEvent.project_id || selectedEvent.okr_id) && (
                    <div className="grid gap-2">
                      <Label>Related</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.task_id && (
                          <Button size="sm" variant="outline" onClick={() => router.push("/tasks")}>
                            Open Tasks
                          </Button>
                        )}
                        {selectedEvent.project_id && (
                          <Button size="sm" variant="outline" onClick={() => router.push("/projects")}>
                            Open Projects
                          </Button>
                        )}
                        {selectedEvent.okr_id && (
                          <Button size="sm" variant="outline" onClick={() => router.push("/okr")}>
                            Open OKR
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Event ID: {selectedEvent.id}
                  </div>
                </TabsContent>

                <TabsContent value="actions" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label>Change Status</Label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateEventStatus(selectedEvent.id, EventStatus.CONFIRMED)}
                        disabled={selectedEvent.status === EventStatus.CONFIRMED}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateEventStatus(selectedEvent.id, EventStatus.COMPLETED)}
                        disabled={selectedEvent.status === EventStatus.COMPLETED}
                      >
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateEventStatus(selectedEvent.id, EventStatus.CANCELLED)}
                        disabled={selectedEvent.status === EventStatus.CANCELLED}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Event
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteEventHandler(selectedEvent.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
