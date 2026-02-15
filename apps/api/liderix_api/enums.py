"""
Centralized enums for the entire Liderix API
All enumerations are defined here to ensure consistency across models, schemas, and services
"""

from enum import Enum
from typing import List


# === CORE STATUS ENUMS ===

class TaskStatus(str, Enum):
    """Task status enumeration - used across Task model and schemas"""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"

    @classmethod
    def get_active_statuses(cls) -> List[str]:
        """Returns list of active task statuses"""
        return [cls.TODO, cls.IN_PROGRESS, cls.IN_REVIEW, cls.BLOCKED]

    @classmethod
    def get_completed_statuses(cls) -> List[str]:
        """Returns list of completed task statuses"""
        return [cls.DONE, cls.CANCELLED]


class TaskPriority(str, Enum):
    """Task priority enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskType(str, Enum):
    """Task type enumeration"""
    TASK = "task"
    BUG = "bug"
    FEATURE = "feature"
    IMPROVEMENT = "improvement"
    RESEARCH = "research"


class TaskParticipantRole(str, Enum):
    """Task participant roles"""
    CREATOR = "creator"
    ASSIGNEE = "assignee"
    RESPONSIBLE = "responsible"
    APPROVER = "approver"
    WATCHER = "watcher"


class TaskApprovalStatus(str, Enum):
    """Task approval status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ProjectStatus(str, Enum):
    """Project status enumeration"""
    DRAFT = "draft"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class ProjectPriority(str, Enum):
    """Project priority enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# === USER AND ORGANIZATION ENUMS ===

class UserRole(str, Enum):
    """User role enumeration - unified system"""
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"
    GUEST = "guest"

    @classmethod
    def get_privileged_roles(cls) -> List[str]:
        """Returns roles with elevated privileges"""
        return [cls.ADMIN, cls.MANAGER]


class MembershipRole(str, Enum):
    """Organization membership role - hierarchical structure"""
    OWNER = "owner"                    # Full organization access
    ADMIN = "admin"                    # Administrative access
    BU_MANAGER = "bu_manager"          # Business Unit Manager
    HEAD_OF_DEPARTMENT = "hod"         # Head of Department
    TEAM_LEAD = "team_lead"            # Team Lead
    PMO = "pmo"                        # PMO/HR/Finance (scoped read-only)
    MEMBER = "member"                  # Individual Contributor
    GUEST = "guest"                    # Guest/Partner (read-only)

    @classmethod
    def get_management_roles(cls) -> List[str]:
        """Returns roles with management capabilities"""
        return [cls.OWNER, cls.ADMIN, cls.BU_MANAGER, cls.HEAD_OF_DEPARTMENT, cls.TEAM_LEAD]

    @classmethod
    def get_privileged_roles(cls) -> List[str]:
        """Returns roles with full organizational access"""
        return [cls.OWNER, cls.ADMIN]

    @classmethod
    def get_scoped_roles(cls) -> List[str]:
        """Returns roles with scoped (limited) access"""
        return [cls.BU_MANAGER, cls.HEAD_OF_DEPARTMENT, cls.TEAM_LEAD, cls.PMO]


class MembershipStatus(str, Enum):
    """Membership status in organization"""
    ACTIVE = "active"
    PENDING = "pending"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"


class InvitationStatus(str, Enum):
    """Invitation status"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


# === OKR AND KPI ENUMS ===

class OKRStatus(str, Enum):
    """OKR (Objectives and Key Results) status"""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class OKRPeriod(str, Enum):
    """OKR time period"""
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"
    CUSTOM = "custom"


class KPIType(str, Enum):
    """KPI measurement type"""
    PERCENTAGE = "percentage"
    NUMBER = "number"
    CURRENCY = "currency"
    BOOLEAN = "boolean"
    TIME = "time"


class KPITrend(str, Enum):
    """KPI trend direction"""
    UP = "up"         # Higher is better
    DOWN = "down"     # Lower is better
    STABLE = "stable" # Stable is better


# === NOTIFICATION ENUMS ===

class NotificationType(str, Enum):
    """Notification type enumeration"""
    SYSTEM = "system"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_OVERDUE = "task_overdue"
    PROJECT_UPDATE = "project_update"
    MENTION = "mention"
    COMMENT = "comment"
    DEADLINE_REMINDER = "deadline_reminder"
    OKR_UPDATE = "okr_update"
    KPI_ALERT = "kpi_alert"
    INVITATION = "invitation"


class NotificationStatus(str, Enum):
    """Notification status"""
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"


class NotificationChannel(str, Enum):
    """Notification delivery channel"""
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    SLACK = "slack"


# === CRM ENUMS ===

class CRMContactStatus(str, Enum):
    """CRM contact lifecycle status"""
    LEAD = "lead"
    PROSPECT = "prospect"
    CUSTOMER = "customer"
    INACTIVE = "inactive"


class CRMContactPriority(str, Enum):
    """CRM contact priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CRMContactSource(str, Enum):
    """CRM contact acquisition source"""
    WEBSITE = "website"
    REFERRAL = "referral"
    COLD_OUTREACH = "cold_outreach"
    EVENT = "event"
    SOCIAL = "social"


class CRMDealStage(str, Enum):
    """CRM deal stage"""
    PROSPECTING = "prospecting"
    QUALIFICATION = "qualification"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


# === FILE AND UPLOAD ENUMS ===

class FileType(str, Enum):
    """File type enumeration"""
    DOCUMENT = "document"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    ARCHIVE = "archive"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"
    OTHER = "other"


class UploadStatus(str, Enum):
    """File upload status"""
    PENDING = "pending"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# === CALENDAR AND EVENT ENUMS ===

class EventType(str, Enum):
    """Calendar event type"""
    MEETING = "meeting"
    TASK_DEADLINE = "task_deadline"
    PROJECT_MILESTONE = "project_milestone"
    OKR_REVIEW = "okr_review"
    PERSONAL = "personal"
    HOLIDAY = "holiday"
    VACATION = "vacation"
    OTHER = "other"


class EventStatus(str, Enum):
    """Calendar event status"""
    CONFIRMED = "confirmed"
    TENTATIVE = "tentative"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class RecurrenceType(str, Enum):
    """Event recurrence pattern"""
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"


# === AUDIT AND SECURITY ENUMS ===

class AuditAction(str, Enum):
    """Audit log action types"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    VIEW = "view"
    EXPORT = "export"
    IMPORT = "import"
    INVITE = "invite"
    ACCEPT_INVITATION = "accept_invitation"


class ResourceType(str, Enum):
    """Resource type for auditing"""
    USER = "user"
    ORGANIZATION = "organization"
    PROJECT = "project"
    TASK = "task"
    OKR = "okr"
    KPI = "kpi"
    FILE = "file"
    NOTIFICATION = "notification"
    CALENDAR_EVENT = "calendar_event"


# === PERMISSION ENUMS ===

class Permission(str, Enum):
    """System permissions"""
    # User permissions
    USER_VIEW = "user:view"
    USER_CREATE = "user:create"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"

    # Organization permissions
    ORG_VIEW = "org:view"
    ORG_CREATE = "org:create"
    ORG_UPDATE = "org:update"
    ORG_DELETE = "org:delete"
    ORG_MANAGE_MEMBERS = "org:manage_members"

    # Project permissions
    PROJECT_VIEW = "project:view"
    PROJECT_CREATE = "project:create"
    PROJECT_UPDATE = "project:update"
    PROJECT_DELETE = "project:delete"
    PROJECT_MANAGE_MEMBERS = "project:manage_members"

    # Task permissions
    TASK_VIEW = "task:view"
    TASK_CREATE = "task:create"
    TASK_UPDATE = "task:update"
    TASK_DELETE = "task:delete"
    TASK_ASSIGN = "task:assign"

    # OKR permissions
    OKR_VIEW = "okr:view"
    OKR_CREATE = "okr:create"
    OKR_UPDATE = "okr:update"
    OKR_DELETE = "okr:delete"

    # KPI permissions
    KPI_VIEW = "kpi:view"
    KPI_CREATE = "kpi:create"
    KPI_UPDATE = "kpi:update"
    KPI_DELETE = "kpi:delete"

    # Analytics permissions
    ANALYTICS_VIEW = "analytics:view"
    ANALYTICS_EXPORT = "analytics:export"

    # Calendar permissions
    CALENDAR_VIEW = "calendar:view"
    CALENDAR_CREATE = "calendar:create"
    CALENDAR_UPDATE = "calendar:update"
    CALENDAR_DELETE = "calendar:delete"

    # File permissions
    FILE_VIEW = "file:view"
    FILE_UPLOAD = "file:upload"
    FILE_DELETE = "file:delete"

    # Admin permissions
    ADMIN_VIEW = "admin:view"
    ADMIN_MANAGE = "admin:manage"


# === ANALYTICS ENUMS ===

class AnalyticsMetric(str, Enum):
    """Analytics metric types"""
    TASK_COMPLETION_RATE = "task_completion_rate"
    PROJECT_PROGRESS = "project_progress"
    USER_ACTIVITY = "user_activity"
    TIME_TRACKING = "time_tracking"
    OKR_PROGRESS = "okr_progress"
    KPI_PERFORMANCE = "kpi_performance"
    TEAM_PRODUCTIVITY = "team_productivity"
    RESOURCE_UTILIZATION = "resource_utilization"


class TimeRange(str, Enum):
    """Time range for analytics and reports"""
    TODAY = "today"
    YESTERDAY = "yesterday"
    LAST_7_DAYS = "last_7_days"
    LAST_30_DAYS = "last_30_days"
    LAST_90_DAYS = "last_90_days"
    THIS_WEEK = "this_week"
    LAST_WEEK = "last_week"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_QUARTER = "this_quarter"
    LAST_QUARTER = "last_quarter"
    THIS_YEAR = "this_year"
    LAST_YEAR = "last_year"
    CUSTOM = "custom"


# === INTEGRATION ENUMS ===

class IntegrationType(str, Enum):
    """External integration types"""
    SLACK = "slack"
    MICROSOFT_TEAMS = "microsoft_teams"
    GOOGLE_WORKSPACE = "google_workspace"
    JIRA = "jira"
    GITHUB = "github"
    GITLAB = "gitlab"
    TRELLO = "trello"
    ASANA = "asana"
    ZAPIER = "zapier"
    WEBHOOK = "webhook"


class IntegrationStatus(str, Enum):
    """Integration connection status"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PENDING = "pending"
    EXPIRED = "expired"


# === UTILITY FUNCTIONS ===

def get_enum_values(enum_class: type) -> List[str]:
    """Get all values from an enum class"""
    return [item.value for item in enum_class]


def get_enum_choices(enum_class: type) -> List[tuple]:
    """Get enum values as choices for forms"""
    return [(item.value, item.value.replace('_', ' ').title()) for item in enum_class]


def validate_enum_value(enum_class: type, value: str) -> bool:
    """Validate if a value exists in enum"""
    return value in get_enum_values(enum_class)


# === ROLE PERMISSION MAPPING ===

# Legacy UserRole permissions (kept for backward compatibility)
ROLE_PERMISSIONS = {
    UserRole.ADMIN: [
        # Full access to everything
        Permission.USER_VIEW, Permission.USER_CREATE, Permission.USER_UPDATE, Permission.USER_DELETE,
        Permission.ORG_VIEW, Permission.ORG_CREATE, Permission.ORG_UPDATE, Permission.ORG_DELETE, Permission.ORG_MANAGE_MEMBERS,
        Permission.PROJECT_VIEW, Permission.PROJECT_CREATE, Permission.PROJECT_UPDATE, Permission.PROJECT_DELETE, Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
        Permission.OKR_VIEW, Permission.OKR_CREATE, Permission.OKR_UPDATE, Permission.OKR_DELETE,
        Permission.KPI_VIEW, Permission.KPI_CREATE, Permission.KPI_UPDATE, Permission.KPI_DELETE,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD, Permission.FILE_DELETE,
        Permission.ADMIN_VIEW, Permission.ADMIN_MANAGE,
    ],
    UserRole.MANAGER: [
        # Manager permissions - no user/org management
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW, Permission.PROJECT_CREATE, Permission.PROJECT_UPDATE, Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
        Permission.OKR_VIEW, Permission.OKR_CREATE, Permission.OKR_UPDATE,
        Permission.KPI_VIEW, Permission.KPI_CREATE, Permission.KPI_UPDATE,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD, Permission.FILE_DELETE,
    ],
    UserRole.MEMBER: [
        # Member permissions - basic access
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE,
        Permission.OKR_VIEW,
        Permission.KPI_VIEW,
        Permission.ANALYTICS_VIEW,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD,
    ],
    UserRole.GUEST: [
        # Guest permissions - read-only
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW,
        Permission.TASK_VIEW,
        Permission.OKR_VIEW,
        Permission.KPI_VIEW,
        Permission.CALENDAR_VIEW,
        Permission.FILE_VIEW,
    ],
}

# MembershipRole permissions (hierarchical organization structure)
MEMBERSHIP_ROLE_PERMISSIONS = {
    MembershipRole.OWNER: [
        # Full organizational access - can do everything
        Permission.USER_VIEW, Permission.USER_CREATE, Permission.USER_UPDATE, Permission.USER_DELETE,
        Permission.ORG_VIEW, Permission.ORG_CREATE, Permission.ORG_UPDATE, Permission.ORG_DELETE, Permission.ORG_MANAGE_MEMBERS,
        Permission.PROJECT_VIEW, Permission.PROJECT_CREATE, Permission.PROJECT_UPDATE, Permission.PROJECT_DELETE, Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
        Permission.OKR_VIEW, Permission.OKR_CREATE, Permission.OKR_UPDATE, Permission.OKR_DELETE,
        Permission.KPI_VIEW, Permission.KPI_CREATE, Permission.KPI_UPDATE, Permission.KPI_DELETE,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD, Permission.FILE_DELETE,
        Permission.ADMIN_VIEW, Permission.ADMIN_MANAGE,
    ],
    MembershipRole.ADMIN: [
        # Administrative access - similar to owner but cannot delete org
        Permission.USER_VIEW, Permission.USER_CREATE, Permission.USER_UPDATE, Permission.USER_DELETE,
        Permission.ORG_VIEW, Permission.ORG_UPDATE, Permission.ORG_MANAGE_MEMBERS,
        Permission.PROJECT_VIEW, Permission.PROJECT_CREATE, Permission.PROJECT_UPDATE, Permission.PROJECT_DELETE, Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
        Permission.OKR_VIEW, Permission.OKR_CREATE, Permission.OKR_UPDATE, Permission.OKR_DELETE,
        Permission.KPI_VIEW, Permission.KPI_CREATE, Permission.KPI_UPDATE, Permission.KPI_DELETE,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD, Permission.FILE_DELETE,
        Permission.ADMIN_VIEW, Permission.ADMIN_MANAGE,
    ],
    MembershipRole.BU_MANAGER: [
        # Business Unit Manager - manage projects, teams, and resources within BU
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW, Permission.PROJECT_CREATE, Permission.PROJECT_UPDATE, Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
        Permission.OKR_VIEW, Permission.OKR_CREATE, Permission.OKR_UPDATE,
        Permission.KPI_VIEW, Permission.KPI_CREATE, Permission.KPI_UPDATE,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD, Permission.FILE_DELETE,
    ],
    MembershipRole.HEAD_OF_DEPARTMENT: [
        # Head of Department - manage department projects and team members
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW, Permission.PROJECT_CREATE, Permission.PROJECT_UPDATE, Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
        Permission.OKR_VIEW, Permission.OKR_CREATE, Permission.OKR_UPDATE,
        Permission.KPI_VIEW, Permission.KPI_CREATE, Permission.KPI_UPDATE,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD, Permission.FILE_DELETE,
    ],
    MembershipRole.TEAM_LEAD: [
        # Team Lead - manage team tasks and projects
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW, Permission.PROJECT_CREATE, Permission.PROJECT_UPDATE,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE, Permission.TASK_DELETE, Permission.TASK_ASSIGN,
        Permission.OKR_VIEW, Permission.OKR_CREATE, Permission.OKR_UPDATE,
        Permission.KPI_VIEW, Permission.KPI_UPDATE,
        Permission.ANALYTICS_VIEW,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD, Permission.FILE_DELETE,
    ],
    MembershipRole.PMO: [
        # PMO/HR/Finance - read-only access across organization for reporting
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW,
        Permission.TASK_VIEW,
        Permission.OKR_VIEW,
        Permission.KPI_VIEW,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
        Permission.CALENDAR_VIEW,
        Permission.FILE_VIEW,
    ],
    MembershipRole.MEMBER: [
        # Individual Contributor - basic work permissions
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW,
        Permission.TASK_VIEW, Permission.TASK_CREATE, Permission.TASK_UPDATE,
        Permission.OKR_VIEW,
        Permission.KPI_VIEW,
        Permission.ANALYTICS_VIEW,
        Permission.CALENDAR_VIEW, Permission.CALENDAR_CREATE, Permission.CALENDAR_UPDATE,
        Permission.FILE_VIEW, Permission.FILE_UPLOAD,
    ],
    MembershipRole.GUEST: [
        # Guest/Partner - read-only access to shared resources
        Permission.USER_VIEW,
        Permission.ORG_VIEW,
        Permission.PROJECT_VIEW,
        Permission.TASK_VIEW,
        Permission.OKR_VIEW,
        Permission.KPI_VIEW,
        Permission.CALENDAR_VIEW,
        Permission.FILE_VIEW,
    ],
}


def get_role_permissions(role: UserRole) -> List[Permission]:
    """Get permissions for a specific role"""
    return ROLE_PERMISSIONS.get(role, [])


def user_has_permission(user_role: UserRole, permission: Permission) -> bool:
    """Check if user role has specific permission"""
    return permission in get_role_permissions(user_role)


def get_membership_role_permissions(role: MembershipRole) -> List[Permission]:
    """Get permissions for a specific membership role"""
    return MEMBERSHIP_ROLE_PERMISSIONS.get(role, [])


def membership_has_permission(membership_role: MembershipRole, permission: Permission) -> bool:
    """Check if membership role has specific permission"""
    return permission in get_membership_role_permissions(membership_role)
