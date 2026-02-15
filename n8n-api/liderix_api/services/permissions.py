"""
Production-ready permission checking service with role-based access control.
Supports organization-level and project-level permissions with hierarchical roles.
"""
from __future__ import annotations

import logging
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from liderix_api.models.users import User
from liderix_api.models.memberships import Membership
from liderix_api.models.projects import Project
from liderix_api.models.tasks import TaskWatcher
from liderix_api.models.project_members import ProjectMember
from liderix_api.enums import (
    Permission,
    MembershipStatus,
    membership_has_permission
)

logger = logging.getLogger(__name__)


async def check_task_permission(
    session: AsyncSession,
    task,  # Task model instance
    user: User,
    permission: str
) -> bool:
    """
    Check if user has permission to perform action on task
    
    Args:
        session: Database session
        task: Task instance
        user: User instance
        permission: Permission type (read, write, delete)
    
    Returns:
        bool: True if user has permission
    """
    try:
        if not task or not user or not user.is_active:
            return False
        
        # System admins have all permissions
        if getattr(user, 'is_admin', False):
            return True
        
        # Task creator has all permissions
        if hasattr(task, 'creator_id') and task.creator_id == user.id:
            return True
        
        # Task assignee has read/write permissions (but not delete)
        if hasattr(task, 'assignee_id') and task.assignee_id == user.id:
            return permission in ["read", "write"]

        # Task watchers have read-only access
        watcher = await session.scalar(
            select(TaskWatcher.id).where(
                and_(
                    TaskWatcher.task_id == task.id,
                    TaskWatcher.user_id == user.id,
                )
            )
        )
        if watcher:
            return permission == "read"

        # Organization role-based access (with scoped team rules)
        if hasattr(task, 'org_id') and task.org_id:
            membership_result = await session.execute(
                select(Membership.role, Membership.department_id)
                .where(
                    and_(
                        Membership.org_id == task.org_id,
                        Membership.user_id == user.id,
                        Membership.deleted_at.is_(None),
                        Membership.status == MembershipStatus.ACTIVE,
                    )
                )
                .limit(1)
            )
            membership_row = membership_result.first()
            if membership_row:
                membership_role, dept_id = membership_row
                perm_map = {
                    "read": Permission.TASK_VIEW,
                    "write": Permission.TASK_UPDATE,
                    "delete": Permission.TASK_DELETE,
                }
                required_perm = perm_map.get(permission)
                if required_perm and membership_has_permission(membership_role, required_perm):
                    role_value = membership_role.value if hasattr(membership_role, "value") else str(membership_role)
                    if role_value in {"owner", "admin", "bu_manager", "pmo"}:
                        return True
                    if role_value in {"hod", "team_lead"}:
                        if not dept_id:
                            return False
                        candidate_ids = [task.assignee_id, task.creator_id]
                        candidate_ids = [cid for cid in candidate_ids if cid]
                        if not candidate_ids:
                            return False
                        dept_member = await session.scalar(
                            select(Membership.id).where(
                                and_(
                                    Membership.org_id == task.org_id,
                                    Membership.department_id == dept_id,
                                    Membership.user_id.in_(candidate_ids),
                                    Membership.deleted_at.is_(None),
                                    Membership.status == MembershipStatus.ACTIVE,
                                )
                            )
                        )
                        return dept_member is not None

        # If task belongs to a project, check project permissions
        if hasattr(task, 'project_id') and task.project_id:
            # Get the project
            if hasattr(task, 'project') and task.project:
                project = task.project
            else:
                # Load project if not already loaded
                project = await session.get(Project, task.project_id)
            
            if project:
                return await check_project_permission(session, project, user, permission)
        
        # If task belongs to an organization (but no project), check org permissions
        if hasattr(task, 'org_id') and task.org_id:
            return await check_organization_permission(session, task.org_id, user, permission)
        
        # For tasks without project/org, only creator and assignee have access
        return False
        
    except Exception as e:
        logger.error(f"Error checking task permission: {e}")
        return False


async def check_project_permission(
    session: AsyncSession,
    project: Project,
    user: User,
    permission: str
) -> bool:
    """Check if user has permission for specific project"""
    try:
        if not user.is_active:
            return False
        
        # System admins have all permissions
        if getattr(user, 'is_admin', False):
            return True
        
        # Project owner always has full access
        if hasattr(project, 'owner_id') and project.owner_id == user.id:
            return True

        # Org-wide privileged roles can access projects across org
        if hasattr(project, 'org_id') and project.org_id:
            membership = await session.scalar(
                select(Membership).where(
                    and_(
                        Membership.org_id == project.org_id,
                        Membership.user_id == user.id,
                        Membership.deleted_at.is_(None),
                        Membership.status == MembershipStatus.ACTIVE,
                    )
                )
            )
            if membership:
                role_value = membership.role.value if hasattr(membership.role, "value") else str(membership.role)
                if role_value in {"owner", "admin", "bu_manager", "pmo"}:
                    org_perm_map = {
                        "read": Permission.PROJECT_VIEW,
                        "write": Permission.PROJECT_UPDATE,
                        "delete": Permission.PROJECT_DELETE,
                        "admin": Permission.PROJECT_MANAGE_MEMBERS,
                    }
                    required_perm = org_perm_map.get(permission)
                    if required_perm and membership_has_permission(membership.role, required_perm):
                        return True

        # Legacy projects without owner_id: allow active org members to read/write
        if getattr(project, "owner_id", None) is None and getattr(project, "org_id", None):
            org_membership = await session.scalar(
                select(Membership.id).where(
                    and_(
                        Membership.org_id == project.org_id,
                        Membership.user_id == user.id,
                        Membership.deleted_at.is_(None),
                        Membership.status == MembershipStatus.ACTIVE,
                    )
                )
            )
            if org_membership and permission in ["read", "write"]:
                return True
        
        # Check project-specific membership
        project_member = await session.scalar(
            select(ProjectMember).where(
                and_(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id,
                    ProjectMember.deleted_at.is_(None)
                )
            )
        )
        
        if not project_member:
            # Check if project is public and permission is read
            if hasattr(project, 'is_public') and project.is_public and permission == "read":
                return True
            return False
        
        # Role-based permission check using hierarchical permission system
        # Project members use simpler role structure, but we can still leverage the permission system
        project_role = getattr(project_member, 'role', 'member')

        # Map project-level roles to permission checks
        permission_mapping = {
            "read": Permission.PROJECT_VIEW,
            "write": Permission.PROJECT_UPDATE,
            "delete": Permission.PROJECT_DELETE,
            "admin": Permission.PROJECT_MANAGE_MEMBERS
        }

        required_perm = permission_mapping.get(permission)
        if not required_perm:
            return False

        # For project-level permissions, we use a simpler role mapping
        # since projects have their own role structure
        project_role_permissions = {
            "owner": [Permission.PROJECT_VIEW, Permission.PROJECT_UPDATE, Permission.PROJECT_DELETE, Permission.PROJECT_MANAGE_MEMBERS],
            "admin": [Permission.PROJECT_VIEW, Permission.PROJECT_UPDATE, Permission.PROJECT_MANAGE_MEMBERS],
            "member": [Permission.PROJECT_VIEW, Permission.PROJECT_UPDATE],
            "viewer": [Permission.PROJECT_VIEW]
        }

        allowed_perms = project_role_permissions.get(project_role, [])
        return required_perm in allowed_perms
        
    except Exception as e:
        logger.error(f"Error checking project permission: {e}")
        return False


async def check_organization_permission(
    session: AsyncSession,
    organization_id,  # Organization ID or instance
    user: User,
    permission: str
) -> bool:
    """
    Check if user has permission to perform action on organization
    
    Args:
        session: Database session
        organization_id: Organization ID or instance
        user: User instance
        permission: Permission type (read, write, delete, admin)
    
    Returns:
        bool: True if user has permission
    """
    try:
        if not user or not user.is_active:
            return False
        
        # System admins have all permissions
        if getattr(user, 'is_admin', False):
            return True
        
        # Extract organization ID if we got an instance
        if hasattr(organization_id, 'id'):
            org_id = organization_id.id
        else:
            org_id = organization_id
        
        # Check organization membership
        try:
            membership_role = await session.scalar(
                select(Membership.role)
                .where(
                    and_(
                        Membership.org_id == org_id,
                        Membership.user_id == user.id,
                        Membership.deleted_at.is_(None),
                    )
                )
                .limit(1)
            )

            if membership_role:
                # Use hierarchical role-based permissions from enums

                # Map simple permission strings to Permission enum values
                permission_mapping = {
                    "read": [Permission.PROJECT_VIEW, Permission.TASK_VIEW, Permission.OKR_VIEW, Permission.KPI_VIEW],
                    "write": [Permission.PROJECT_UPDATE, Permission.TASK_UPDATE, Permission.OKR_UPDATE, Permission.KPI_UPDATE],
                    "delete": [Permission.PROJECT_DELETE, Permission.TASK_DELETE, Permission.OKR_DELETE, Permission.KPI_DELETE],
                    "admin": [Permission.ORG_MANAGE_MEMBERS, Permission.ADMIN_MANAGE]
                }

                # Check if the membership role has any of the required permissions
                required_perms = permission_mapping.get(permission, [])
                if required_perms:
                    for perm in required_perms:
                        if membership_has_permission(membership_role, perm):
                            return True

                # Fallback to basic check for non-mapped permissions
                return False
            
        except Exception as e:
            logger.debug(f"Error checking organization membership: {e}")
        
        return False
        
    except Exception as e:
        logger.error(f"Error checking organization permission: {e}")
        return False


def require_permission(user: User, permission: str) -> None:
    """
    Check if user has required permission.
    Raises HTTPException if user doesn't have permission.
    """
    # Check if user is admin (using is_admin field)
    admin_permissions = [
        "users:read", "users:write", "users:delete",
        "organizations:admin", "system:admin"
    ]
    
    if permission in admin_permissions:
        if not getattr(user, 'is_admin', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "type": "urn:problem:permission-denied",
                    "title": "Permission Denied",
                    "detail": f"User does not have permission: {permission}",
                    "status": 403
                }
            )
    
    # All other permissions are allowed for active users
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "type": "urn:problem:user-inactive",
                "title": "User Inactive",
                "detail": "User account is not active",
                "status": 403
            }
        )


def has_permission(user: User, permission: str) -> bool:
    """
    Check if user has permission (returns bool instead of raising exception)
    """
    try:
        require_permission(user, permission)
        return True
    except HTTPException:
        return False


def get_user_permissions(user: User) -> list[str]:
    """Get list of all permissions for a user"""
    base_permissions = [
        "profile:read", "profile:write",
        "organizations:join", "organizations:leave",
        "task:read", "task:write"  # Added basic task permissions
    ]
    
    if getattr(user, 'is_admin', False):
        admin_permissions = [
            "users:read", "users:write", "users:delete",
            "organizations:admin", "system:admin",
            "task:delete", "project:admin"
        ]
        return base_permissions + admin_permissions
    
    return base_permissions


# Helper functions for common permission checks
async def can_read_task(session: AsyncSession, task, user: User) -> bool:
    """Helper function to check if user can read task"""
    return await check_task_permission(session, task, user, "read")


async def can_write_task(session: AsyncSession, task, user: User) -> bool:
    """Helper function to check if user can write/edit task"""
    return await check_task_permission(session, task, user, "write")


async def can_delete_task(session: AsyncSession, task, user: User) -> bool:
    """Helper function to check if user can delete task"""
    return await check_task_permission(session, task, user, "delete")


async def can_read_project(session: AsyncSession, project: Project, user: User) -> bool:
    """Helper function to check if user can read project"""
    return await check_project_permission(session, project, user, "read")


async def can_write_project(session: AsyncSession, project: Project, user: User) -> bool:
    """Helper function to check if user can write/edit project"""
    return await check_project_permission(session, project, user, "write")


async def can_delete_project(session: AsyncSession, project: Project, user: User) -> bool:
    """Helper function to check if user can delete project"""
    return await check_project_permission(session, project, user, "delete")


def is_system_admin(user: User) -> bool:
    """Check if user is system administrator"""
    return getattr(user, 'is_admin', False)


def is_active_user(user: User) -> bool:
    """Check if user is active"""
    return user and getattr(user, 'is_active', False)


async def check_organization_access(
    session: AsyncSession,
    organization_id,
    user: User
) -> bool:
    """
    Check if user has access to organization (alias for check_organization_permission with read)

    Args:
        session: Database session
        organization_id: Organization ID or instance
        user: User instance

    Returns:
        bool: True if user has read access to the organization
    """
    return await check_organization_permission(session, organization_id, user, "read")
