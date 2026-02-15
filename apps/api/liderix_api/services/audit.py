# apps/api/liderix_api/services/audit.py
"""
Audit logging service for tracking user actions and system events.
Persists audit events in the database and falls back to logging on failures.
"""
from __future__ import annotations

import logging
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import LiderixAsyncSessionLocal
from liderix_api.models.audit import EventLog

logger = logging.getLogger(__name__)


class AuditLogger:
    """Audit logging service for tracking user actions"""
    
    @staticmethod
    async def log_event(
        session: Optional[AsyncSession],
        user_id: Optional[UUID],
        action: str,
        success: bool,
        ip_address: str,
        user_agent: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log an audit event
        
        Args:
            session: Database session (can be None)
            user_id: ID of user performing action
            action: Action being performed (e.g., 'user.login', 'user.profile.update')
            success: Whether action was successful
            ip_address: IP address of the request
            user_agent: User agent string from request
            metadata: Additional metadata about the event
        """
        payload = metadata or {}
        org_id = payload.get("org_id")
        try:
            if isinstance(org_id, str):
                org_id = UUID(org_id)
        except Exception:
            org_id = None

        async def _write_event(db_session: AsyncSession) -> None:
            event = EventLog(
                user_id=user_id,
                org_id=org_id,
                event_type=action,
                success=success,
                ip_address=ip_address,
                user_agent=user_agent,
                data=payload,
            )
            db_session.add(event)
            await db_session.commit()

        try:
            if session is not None:
                await _write_event(session)
                return

            async with LiderixAsyncSessionLocal() as db_session:
                await _write_event(db_session)
        except Exception as exc:
            logger.error("Audit log persistence failed: %s", exc)
            logger.info(
                "Audit fallback: action=%s user_id=%s success=%s ip=%s metadata=%s",
                action,
                user_id,
                success,
                ip_address,
                payload,
            )
    
    @staticmethod
    async def log_security_event(
        user_id: Optional[UUID],
        event_type: str,
        severity: str,
        details: Dict[str, Any],
        ip_address: str,
        user_agent: str
    ) -> None:
        """Log security-related events"""
        payload = {"severity": severity, "details": details}
        org_id = details.get("org_id")
        try:
            if isinstance(org_id, str):
                org_id = UUID(org_id)
        except Exception:
            org_id = None

        try:
            async with LiderixAsyncSessionLocal() as db_session:
                event = EventLog(
                    user_id=user_id,
                    org_id=org_id,
                    event_type=f"security.{event_type}",
                    success=False,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    data=payload,
                )
                db_session.add(event)
                await db_session.commit()
        except Exception as exc:
            logger.error("Security audit log failed: %s", exc)
            logger.warning(
                "Security Event fallback: type=%s user_id=%s severity=%s ip=%s details=%s",
                event_type,
                user_id,
                severity,
                ip_address,
                details,
            )
