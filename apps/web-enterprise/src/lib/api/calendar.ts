
import { api } from '@/lib/api/config'
import { Task, TaskStatus, TaskPriority } from "./tasks"

// ============================================================================
// Calendar Event Types (matching backend)
// ============================================================================

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  event_type: EventType
  status: EventStatus
  start_date: string  // ISO 8601
  end_date: string    // ISO 8601
  is_all_day: boolean
  timezone: string
  location?: string
  meeting_url?: string
  meeting_id?: string
  meeting_password?: string
  creator_id?: string
  task_id?: string
  project_id?: string
  okr_id?: string
  recurrence_type: RecurrenceType
  recurrence_pattern?: RecurrencePattern
  recurrence_end_date?: string
  parent_event_id?: string
  is_private: boolean
  is_important: boolean
  reminder_minutes?: number
  color: string
  external_id?: string
  external_source?: string
  meta_data?: Record<string, unknown>
  org_id: string
  created_at: string
  updated_at: string
  deleted_at?: string
  is_deleted: boolean
  attendees?: EventAttendee[]
  duration_minutes?: number
}

export interface EventAttendee {
  id: string
  event_id: string
  user_id?: string
  email?: string
  display_name?: string
  status: AttendeeStatus
  is_organizer: boolean
  is_required: boolean
  response_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface RecurrencePattern {
  interval: number
  days_of_week?: number[]  // 0=Monday, 6=Sunday
  day_of_month?: number
  month_of_year?: number
  count?: number
  exceptions?: string[]  // ISO dates to exclude
}

export enum EventType {
  MEETING = "meeting",
  TASK_DEADLINE = "task_deadline",
  PROJECT_MILESTONE = "project_milestone",
  OKR_REVIEW = "okr_review",
  PERSONAL = "personal",
  HOLIDAY = "holiday",
  VACATION = "vacation",
  OTHER = "other"
}

export enum EventStatus {
  CONFIRMED = "confirmed",
  TENTATIVE = "tentative",
  CANCELLED = "cancelled",
  COMPLETED = "completed"
}

export enum RecurrenceType {
  NONE = "none",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
  CUSTOM = "custom"
}

export enum AttendeeStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  TENTATIVE = "tentative"
}

const normalizeEventType = (value: unknown): EventType => {
  if (!value) return EventType.OTHER
  const raw = String(value).toLowerCase()
  const allowed = Object.values(EventType) as string[]
  if (allowed.includes(raw)) return raw as EventType
  if (raw === "task" || raw === "deadline") return EventType.TASK_DEADLINE
  if (raw === "milestone") return EventType.PROJECT_MILESTONE
  if (raw === "okr") return EventType.OKR_REVIEW
  return EventType.OTHER
}

const normalizeEventStatus = (value: unknown): EventStatus => {
  if (!value) return EventStatus.CONFIRMED
  const raw = String(value).toLowerCase()
  const allowed = Object.values(EventStatus) as string[]
  if (allowed.includes(raw)) return raw as EventStatus
  if (raw === "done") return EventStatus.COMPLETED
  if (raw === "in_progress") return EventStatus.CONFIRMED
  return EventStatus.CONFIRMED
}

const normalizeEvent = (event: CalendarEvent): CalendarEvent => {
  const startDate = event.start_date || event.end_date
  const endDate = event.end_date || event.start_date
  return {
    ...event,
    event_type: normalizeEventType(event.event_type),
    status: normalizeEventStatus(event.status),
    start_date: startDate || event.start_date,
    end_date: endDate || event.end_date,
    is_all_day: Boolean(event.is_all_day),
  }
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateEventRequest {
  title: string
  description?: string
  event_type: EventType
  start_date: string  // ISO 8601
  end_date: string    // ISO 8601
  is_all_day?: boolean
  timezone?: string
  location?: string
  meeting_url?: string
  meeting_id?: string
  meeting_password?: string
  task_id?: string
  project_id?: string
  okr_id?: string
  recurrence_type?: RecurrenceType
  recurrence_pattern?: RecurrencePattern
  recurrence_end_date?: string
  is_private?: boolean
  is_important?: boolean
  reminder_minutes?: number
  color?: string
  meta_data?: Record<string, unknown>
  attendees?: CreateEventAttendee[]
}

export interface CreateEventAttendee {
  user_id?: string
  email?: string
  display_name?: string
  is_required?: boolean
  notes?: string
}

export interface UpdateEventRequest {
  title?: string
  description?: string
  event_type?: EventType
  status?: EventStatus
  start_date?: string
  end_date?: string
  is_all_day?: boolean
  timezone?: string
  location?: string
  meeting_url?: string
  meeting_id?: string
  meeting_password?: string
  recurrence_type?: RecurrenceType
  recurrence_pattern?: RecurrencePattern
  recurrence_end_date?: string
  is_private?: boolean
  is_important?: boolean
  reminder_minutes?: number
  color?: string
  meta_data?: Record<string, unknown>
}

export interface EventListResponse {
  events: CalendarEvent[]
  total: number
  page: number
  page_size: number
  has_next: boolean
}

export interface RitualBootstrapResponse {
  okr_reviews_created: number
  okr_reviews_skipped: number
  project_milestones_created: number
  project_milestones_skipped: number
}

export interface EventQueryParams {
  start_date?: string
  end_date?: string
  event_type?: EventType
  status?: EventStatus
  project_id?: string
  task_id?: string
  okr_id?: string
  search?: string
  page?: number
  page_size?: number
}

interface LegacyCalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: EventType
  description?: string
  status: EventStatus
  tags: string[]
  allDay: boolean
  recurring: boolean
  location?: string
  attendees?: string[]
  project_id?: string
  task_id?: string
  okr_id?: string
}

interface ProjectLike {
  id: string
  name: string
  description?: string
  end_date?: string
  created_at?: string
  updated_at?: string
}

// ============================================================================
// Legacy types for backward compatibility
// ============================================================================

export interface OKREvent {
  id: string
  title: string
  description?: string
  status: string
  timeframe: string
  owner_id: string
  target_date?: string
  progress: number
  created_at: string
  updated_at: string
}

export interface Meeting {
  id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  attendees: string[]
  organizer_id: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
}

// ============================================================================
// Calendar API Client
// ============================================================================

export class CalendarAPI {
  /**
   * Get calendar events with optional filtering
   */
  static async getEvents(params?: EventQueryParams): Promise<CalendarEvent[]> {
    try {
      const queryParams = new URLSearchParams()

      if (params?.start_date) queryParams.append('start_date', params.start_date)
      if (params?.end_date) queryParams.append('end_date', params.end_date)
      if (params?.event_type) queryParams.append('event_type', params.event_type)
      if (params?.status) queryParams.append('status', params.status)
      if (params?.project_id) queryParams.append('project_id', params.project_id)
      if (params?.task_id) queryParams.append('task_id', params.task_id)
      if (params?.okr_id) queryParams.append('okr_id', params.okr_id)
      if (params?.search) queryParams.append('search', params.search)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString())

      const url = `/calendar-events${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      const response = await api.get<EventListResponse>(url)

      return (response.data.events || []).map(normalizeEvent)
    } catch (error) {
      console.error('Failed to fetch calendar events:', error)
      // Fallback to legacy behavior if calendar API fails
      return this.getLegacyEvents(params?.start_date, params?.end_date)
    }
  }

  /**
   * Get a single event by ID
   */
  static async getEvent(eventId: string): Promise<CalendarEvent> {
    const response = await api.get<CalendarEvent>(`/calendar-events/${eventId}`)
    return normalizeEvent(response.data)
  }

  /**
   * Create a new calendar event
   */
  static async createEvent(eventData: CreateEventRequest): Promise<CalendarEvent> {
    const response = await api.post<CalendarEvent>('/calendar-events/', eventData)
    return normalizeEvent(response.data)
  }

  /**
   * Update an existing event
   */
  static async updateEvent(eventId: string, updates: UpdateEventRequest): Promise<CalendarEvent> {
    const response = await api.patch<CalendarEvent>(`/calendar-events/${eventId}`, updates)
    return normalizeEvent(response.data)
  }

  /**
   * Delete an event
   */
  static async deleteEvent(eventId: string, hardDelete: boolean = false): Promise<void> {
    await api.delete(`/calendar-events/${eventId}?hard_delete=${hardDelete}`)
  }

  /**
   * Get event attendees
   */
  static async getEventAttendees(eventId: string): Promise<EventAttendee[]> {
    const response = await api.get<EventAttendee[]>(`/calendar-events/${eventId}/attendees`)
    return response.data
  }

  /**
   * Update attendee RSVP status
   */
  static async updateAttendeeStatus(
    eventId: string,
    attendeeId: string,
    status: AttendeeStatus,
    notes?: string
  ): Promise<EventAttendee> {
    const response = await api.patch<EventAttendee>(
      `/calendar-events/${eventId}/attendees/${attendeeId}`,
      { status, notes }
    )
    return response.data
  }

  /**
   * Bulk update event status
   */
  static async bulkUpdateStatus(eventIds: string[], status: EventStatus): Promise<number> {
    const response = await api.post<{ affected_count: number }>(
      '/calendar-events/bulk/status',
      { event_ids: eventIds, status }
    )
    return response.data.affected_count
  }

  static async bootstrapRituals(): Promise<RitualBootstrapResponse> {
    const response = await api.post<RitualBootstrapResponse>('/calendar-events/rituals/bootstrap')
    return response.data
  }

  /**
   * Bulk delete events
   */
  static async bulkDelete(eventIds: string[], deleteRecurring: boolean = false): Promise<number> {
    const response = await api.post<{ affected_count: number }>(
      '/calendar-events/bulk/delete',
      { event_ids: eventIds, delete_recurring: deleteRecurring }
    )
    return response.data.affected_count
  }

  /**
   * Update event status
   */
  static async updateEventStatus(eventId: string, status: EventStatus): Promise<CalendarEvent> {
    const response = await api.patch<CalendarEvent>(`/calendar-events/${eventId}`, { status })
    return normalizeEvent(response.data)
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get calendar statistics
   */
  static async getCalendarStats(): Promise<{
    total_events: number
    completed_events: number
    upcoming_events: number
    overdue_events: number
  }> {
    const events = await this.getEvents()
    const now = new Date()

    return {
      total_events: events.length,
      completed_events: events.filter(e => e.status === EventStatus.COMPLETED).length,
      upcoming_events: events.filter(e => new Date(e.start_date) > now).length,
      overdue_events: events.filter(e =>
        new Date(e.start_date) < now &&
        e.status !== EventStatus.COMPLETED &&
        e.status !== EventStatus.CANCELLED
      ).length
    }
  }

  /**
   * Get upcoming deadlines
   */
  static async getUpcomingDeadlines(days: number = 7): Promise<CalendarEvent[]> {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(now.getDate() + days)

    const events = await this.getEvents({
      start_date: now.toISOString(),
      end_date: futureDate.toISOString(),
      page_size: 100
    })

    return events
      .filter(event =>
        event.event_type === EventType.TASK_DEADLINE ||
        event.event_type === EventType.PROJECT_MILESTONE
      )
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  }

  /**
   * Get overdue events
   */
  static async getOverdueEvents(): Promise<CalendarEvent[]> {
    const now = new Date()
    const events = await this.getEvents({ page_size: 100 })

    return events
      .filter(event =>
        new Date(event.start_date) < now &&
        event.status !== EventStatus.COMPLETED &&
        event.status !== EventStatus.CANCELLED
      )
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  }

  /**
   * Convert event to legacy format for compatibility
   */
  static toLegacyFormat(event: CalendarEvent): LegacyCalendarEvent {
    return {
      id: event.id,
      title: event.title,
      start: new Date(event.start_date),
      end: new Date(event.end_date),
      type: event.event_type,
      description: event.description,
      status: event.status,
      tags: [event.event_type, event.status],
      allDay: event.is_all_day,
      recurring: event.recurrence_type !== RecurrenceType.NONE,
      location: event.location,
      attendees: event.attendees?.map(a => a.display_name || a.email || ''),
      project_id: event.project_id,
      task_id: event.task_id,
      okr_id: event.okr_id
    }
  }

  // ============================================================================
  // Legacy Methods (fallback to tasks/OKRs/projects)
  // ============================================================================

  /**
   * Legacy method: Get events from tasks, OKRs, and projects
   * Used as fallback if calendar API is unavailable
   */
  private static async getLegacyEvents(startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = []

    // Fetch tasks
    try {
      const tasksResponse = await api.get('/tasks/')
      const tasks: Task[] = tasksResponse.data

      const taskEvents: CalendarEvent[] = tasks
        .filter(task => task.due_date)
        .map(task => this.taskToCalendarEvent(task))

      events.push(...taskEvents)
    } catch (error) {
      console.error('Failed to fetch tasks for calendar:', error)
    }

    // Fetch OKRs
    try {
      const okrsResponse = await api.get('/okrs')
      const okrs: OKREvent[] = okrsResponse.data

      const okrEvents: CalendarEvent[] = okrs
        .filter(okr => okr.target_date)
        .map(okr => this.okrToCalendarEvent(okr))

      events.push(...okrEvents)
    } catch (error) {
      console.error('Failed to fetch OKRs for calendar:', error)
    }

    // Fetch projects
    try {
      const projectsResponse = await api.get<ProjectLike[]>('/projects/')
      const projects = projectsResponse.data

      const milestoneEvents: CalendarEvent[] = projects
        .filter((project) => project.end_date)
        .map((project) => this.projectToCalendarEvent(project))

      events.push(...milestoneEvents)
    } catch (error) {
      console.error('Failed to fetch projects for calendar:', error)
    }

    // Filter by date range if provided
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      return events.filter(event => {
        const eventStart = new Date(event.start_date)
        return eventStart >= start && eventStart <= end
      })
    }

    return events
  }

  private static taskToCalendarEvent(task: Task): CalendarEvent {
    return {
      id: `task-${task.id}`,
      title: task.title,
      description: task.description,
      event_type: EventType.TASK_DEADLINE,
      status: task.status === TaskStatus.DONE ? EventStatus.COMPLETED : EventStatus.CONFIRMED,
      start_date: task.due_date!,
      end_date: task.due_date!,
      is_all_day: true,
      timezone: 'UTC',
      recurrence_type: RecurrenceType.NONE,
      is_private: false,
      is_important: task.priority === TaskPriority.CRITICAL || task.priority === TaskPriority.HIGH,
      color: this.getPriorityColor(task.priority),
      org_id: '',
      created_at: task.created_at,
      updated_at: task.updated_at,
      is_deleted: false,
      task_id: task.id,
      project_id: task.project_id
    }
  }

  private static okrToCalendarEvent(okr: OKREvent): CalendarEvent {
    return {
      id: `okr-${okr.id}`,
      title: `🌟 ${okr.title}`,
      description: okr.description,
      event_type: EventType.OKR_REVIEW,
      status: EventStatus.CONFIRMED,
      start_date: okr.target_date!,
      end_date: okr.target_date!,
      is_all_day: true,
      timezone: 'UTC',
      recurrence_type: RecurrenceType.NONE,
      is_private: false,
      is_important: true,
      color: '#f59e0b',
      org_id: '',
      created_at: okr.created_at,
      updated_at: okr.updated_at,
      is_deleted: false,
      okr_id: okr.id
    }
  }

  private static projectToCalendarEvent(project: ProjectLike): CalendarEvent {
    return {
      id: `project-${project.id}`,
      title: `📄 ${project.name} Deadline`,
      description: project.description,
      event_type: EventType.PROJECT_MILESTONE,
      status: EventStatus.CONFIRMED,
      start_date: project.end_date,
      end_date: project.end_date,
      is_all_day: true,
      timezone: 'UTC',
      recurrence_type: RecurrenceType.NONE,
      is_private: false,
      is_important: true,
      color: '#8b5cf6',
      org_id: '',
      created_at: project.created_at || new Date().toISOString(),
      updated_at: project.updated_at || new Date().toISOString(),
      is_deleted: false,
      project_id: project.id
    }
  }

  private static getPriorityColor(priority?: TaskPriority): string {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return '#ef4444'
      case TaskPriority.HIGH:
        return '#f97316'
      case TaskPriority.MEDIUM:
        return '#3b82f6'
      case TaskPriority.LOW:
        return '#10b981'
      default:
        return '#6b7280'
    }
  }
}
