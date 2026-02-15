import logging
import uuid
import asyncio
import inspect
import json
from typing import Optional, AsyncGenerator
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.requests import Request as FastAPIRequest
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine, create_async_engine
from sqlalchemy.orm import sessionmaker

from liderix_api.config.settings import settings
from liderix_api.db import get_async_session as core_get_async_session
from liderix_api.middleware.security import add_security_middleware

logger = logging.getLogger("uvicorn.error")

# -----------------------------------------------------------------------------
# Приложение
# -----------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json",
    debug=bool(getattr(settings, "DEBUG", False)),
)

# -----------------------------------------------------------------------------
# Static uploads
# -----------------------------------------------------------------------------
uploads_root = Path(settings.UPLOADS_DIR).resolve()
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_root)), name="uploads")

# -----------------------------------------------------------------------------
# CORS — production-ready with environment configuration
# -----------------------------------------------------------------------------
DEFAULT_ORIGINS = [
    "https://n8n-web.itstep.org",
    "https://n8n-api.itstep.org",
    "https://n8n.itstep.org",
    "http://localhost:3002",
    "http://localhost:3001",
]

ALLOWED_ORIGINS = getattr(settings, "CORS_ALLOW_ORIGINS", DEFAULT_ORIGINS)

if isinstance(ALLOWED_ORIGINS, str):
    if "," in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS = [s.strip() for s in ALLOWED_ORIGINS.split(",") if s.strip()]
    elif ALLOWED_ORIGINS.strip() == "*":
        logger.warning("CORS wildcard '*' not allowed with credentials=True, using default origins")
        ALLOWED_ORIGINS = DEFAULT_ORIGINS
    else:
        try:
            ALLOWED_ORIGINS = json.loads(ALLOWED_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            ALLOWED_ORIGINS = [ALLOWED_ORIGINS.strip()]

    if not ALLOWED_ORIGINS:
        logger.warning("Failed to parse CORS_ALLOW_ORIGINS, using defaults")
        ALLOWED_ORIGINS = DEFAULT_ORIGINS

# -----------------------------------------------------------------------------
# Security middleware headers (управляемо для local/debug)
# -----------------------------------------------------------------------------
# В Settings добавь (опционально): SECURITY_HEADERS_ENABLED: bool = True
SECURITY_HEADERS_ENABLED = bool(getattr(settings, "SECURITY_HEADERS_ENABLED", True))
if SECURITY_HEADERS_ENABLED:
    add_security_middleware(app)
else:
    logger.warning("Security middleware disabled by settings.SECURITY_HEADERS_ENABLED=False")

# -----------------------------------------------------------------------------
# CORS — production-ready with environment configuration
# -----------------------------------------------------------------------------
logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Content-Type", "Authorization"],
)

# -----------------------------------------------------------------------------
# БД: основная (Liderix)
# -----------------------------------------------------------------------------
if not settings.LIDERIX_DB_URL:
    raise RuntimeError("LIDERIX_DB_URL is not configured")

try:
    engine_liderix: AsyncEngine = create_async_engine(
        settings.LIDERIX_DB_URL,
        echo=bool(getattr(settings, "SQL_ECHO", False)),
        pool_pre_ping=True,
        pool_size=getattr(settings, "DB_POOL_SIZE", 5),
        max_overflow=getattr(settings, "DB_MAX_OVERFLOW", 10),
        pool_timeout=30,
        pool_recycle=3600,
    )
    SessionLiderix = sessionmaker(engine_liderix, class_=AsyncSession, expire_on_commit=False)
except Exception as e:
    logger.error(f"Failed to create primary database engine: {e}")
    raise


async def get_liderix_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLiderix() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            try:
                await session.rollback()
            except Exception:
                pass
            raise
        finally:
            try:
                await session.close()
            except Exception:
                pass


# -----------------------------------------------------------------------------
# БД: клиентская (ITSTEP) - используем из db.py
# -----------------------------------------------------------------------------
from liderix_api.db import get_itstep_session, itstep_engine, get_itstep_db_url  # noqa: E402

logger.info("Using ITSTEP DB configuration from db.py module")

# -----------------------------------------------------------------------------
# Middleware: Suppress audit logs for auth errors
# -----------------------------------------------------------------------------
@app.middleware("http")
async def suppress_auth_audit_errors(request: Request, call_next):
    """
    Подавляем аудит-логи для auth ошибок (чтобы избежать constraint ошибок).
    Но сами исключения НЕ скрываем.
    """
    try:
        return await call_next(request)
    except Exception as e:
        if "auth" in str(request.url).lower() and ("401" in str(e) or "refresh" in str(e).lower()):
            logger.warning(f"Auth error suppressed for audit: {e}")
        raise


# -----------------------------------------------------------------------------
# Middleware: X-Request-ID
# -----------------------------------------------------------------------------
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    try:
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        logger.error(f"Request {request_id} failed: {e}")
        raise


# -----------------------------------------------------------------------------
# Startup/Shutdown
# -----------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    logger.info("Starting application...")

    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with engine_liderix.begin() as conn:
                await conn.run_sync(lambda *_: None)
            logger.info("Primary DB connection is warm.")
            break
        except Exception as e:
            logger.error(f"Primary DB warmup failed (attempt {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                logger.critical("Primary DB warmup failed after all retries")
                raise
            await asyncio.sleep(2)

    if itstep_engine is not None:
        try:
            async with itstep_engine.begin() as conn:
                await conn.run_sync(lambda *_: None)
            logger.info("Client DB (ITSTEP) connection is warm.")
        except Exception as e:
            logger.warning(f"Client DB (ITSTEP) warmup failed: {e}")

    app.dependency_overrides[core_get_async_session] = get_liderix_session
    logger.info("Application startup completed.")


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down application...")

    try:
        await engine_liderix.dispose()
        logger.info("Primary DB connections disposed.")
    except Exception as e:
        logger.warning(f"Dispose primary DB error: {e}")

    if itstep_engine is not None:
        try:
            await itstep_engine.dispose()
            logger.info("Client DB connections disposed.")
        except Exception as e:
            logger.warning(f"Dispose client DB error: {e}")

    logger.info("Application shutdown completed.")


# -----------------------------------------------------------------------------
# Health checks
# -----------------------------------------------------------------------------
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "timestamp": uuid.uuid4().hex[:8]}


@app.get("/health/live", tags=["System"])
async def liveness():
    return {"status": "alive"}


@app.get("/health/ready", tags=["System"])
async def readiness():
    checks = {}
    overall_status = "ready"

    try:
        async with engine_liderix.begin() as conn:
            await conn.run_sync(lambda *_: None)
        checks["primary_db"] = {"status": "healthy", "type": "postgresql"}
    except Exception as e:
        checks["primary_db"] = {"status": "unhealthy", "error": str(e)[:200]}
        overall_status = "degraded"

    if itstep_engine is not None:
        try:
            async with itstep_engine.begin() as conn:
                await conn.run_sync(lambda *_: None)
            checks["client_db"] = {"status": "healthy", "type": "postgresql"}
        except Exception as e:
            checks["client_db"] = {"status": "unhealthy", "error": str(e)[:200]}
    else:
        checks["client_db"] = {"status": "not_configured"}

    return {"status": overall_status, "checks": checks, "timestamp": uuid.uuid4().hex[:8]}


# -----------------------------------------------------------------------------
# Подключение роутеров
# -----------------------------------------------------------------------------
PREFIX = (getattr(settings, "API_PREFIX", "/api") or "/api").rstrip("/")

from liderix_api.routes import (  # noqa: E402
    users as users_router,
    client as client_router,
    crm as crm_router,
    audit as audit_router,
    notifications as notifications_router,
    teams as teams_router,
    projects as projects_router,
    tasks as tasks_router,
    okrs as okrs_router,
    kpis as kpis_router,
    metrics as metrics_router,
    auth as auth_router,
    media_proxy as media_proxy_router,
    analytics as analytics_router,
    calendar_events as calendar_router,
    event_links as event_links_router,
    onboarding as onboarding_router,
    integrations as integrations_router,
    ai as ai_router,
)


try:
    from liderix_api.test_analytics_endpoint import router as test_analytics_router  # noqa: E402
    TEST_ANALYTICS_AVAILABLE = True
except ImportError:
    TEST_ANALYTICS_AVAILABLE = False

app.include_router(users_router.router, prefix=PREFIX, tags=["Users"])
app.include_router(client_router.router, prefix=PREFIX, tags=["Clients"])
app.include_router(crm_router.router, prefix=PREFIX, tags=["CRM"])
app.include_router(audit_router.router, prefix=PREFIX, tags=["Audit"])
app.include_router(notifications_router.router, prefix=PREFIX, tags=["Notifications"])
app.include_router(teams_router.router, prefix=PREFIX, tags=["Teams"])
app.include_router(projects_router.router, prefix=f"{PREFIX}/projects", tags=["Projects"])
app.include_router(tasks_router.router, prefix=PREFIX, tags=["Tasks"])
app.include_router(okrs_router.router, prefix=f"{PREFIX}/okrs", tags=["OKRs"])
app.include_router(kpis_router.router, prefix=PREFIX, tags=["KPIs"])
app.include_router(metrics_router.router, prefix=PREFIX, tags=["Metrics"])
app.include_router(calendar_router.router, prefix=f"{PREFIX}/calendar-events", tags=["Calendar"])
app.include_router(event_links_router.router, prefix=f"{PREFIX}/links", tags=["Event Links"])
app.include_router(onboarding_router.router, prefix=f"{PREFIX}/onboarding", tags=["Onboarding"])
app.include_router(auth_router.router, prefix=PREFIX, tags=["Auth"])
app.include_router(media_proxy_router.router, prefix=PREFIX, tags=["Media"])
app.include_router(integrations_router.router, prefix=PREFIX, tags=["Integrations"])
app.include_router(ai_router.router, prefix=PREFIX, tags=["AI"])
app.include_router(analytics_router.router, prefix=f"{PREFIX}/analytics", tags=["Analytics"])

if TEST_ANALYTICS_AVAILABLE:
    app.include_router(test_analytics_router, prefix=PREFIX, tags=["Test Analytics"])



# -----------------------------------------------------------------------------
# Direct test endpoints for ITSTEP analytics
# -----------------------------------------------------------------------------
def _mask_dsn(dsn: str) -> str:
    try:
        p = urlparse(dsn)
        if not p.username:
            return dsn
        netloc = p.netloc
        if "@" in netloc and ":" in netloc.split("@")[0]:
            userinfo, hostinfo = netloc.split("@", 1)
            user = userinfo.split(":", 1)[0]
            netloc = f"{user}:***@{hostinfo}"
        return urlunparse(p._replace(netloc=netloc))
    except Exception:
        return "postgresql://***:***@***:5432/***"


def _sanitize_asyncpg_dsn(dsn: str) -> tuple[str, bool | None]:
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
    p = urlparse(dsn)
    q = parse_qs(p.query, keep_blank_values=True)

    ssl_flag: bool | None = None

    ssl_v = (q.get("ssl", [None])[-1] or "").strip().lower()
    if ssl_v in {"0", "false", "off", "no"}:
        ssl_flag = False

    sslmode_v = (q.get("sslmode", [None])[-1] or "").strip().lower()
    if sslmode_v == "disable":
        ssl_flag = False

    q.pop("ssl", None)
    q.pop("sslmode", None)

    flat_q = {k: v[-1] for k, v in q.items() if v and v[-1] is not None}
    new_query = urlencode(flat_q)

    clean = urlunparse(p._replace(query=new_query))
    return clean, ssl_flag


@app.get("/api/test-itstep/health", tags=["System"])
async def test_itstep_health():
    return {
        "status": "healthy",
        "service": "ITstep Direct Analytics",
        "database_url_configured": bool(settings.ITSTEP_DB_URL),
        "engine_ready": itstep_engine is not None,
        "timestamp": "2025-09-29",
    }


@app.get("/api/test-itstep/connection", tags=["System"])
async def test_itstep_connection():
    if itstep_engine is None:
        return {"status": "error", "message": "ITSTEP DB is not configured"}

    try:
        async with itstep_engine.connect() as conn:
            res = await conn.exec_driver_sql("SELECT version() AS db_version, current_database() AS db_name")
            row = res.first()

        return {
            "status": "success",
            "message": "ITstep database connection successful",
            "database": row.db_name if row else "unknown",
            "version": row.db_version if row else "unknown",
        }
    except Exception as e:
        raw_url = get_itstep_db_url() or settings.ITSTEP_DB_URL or ""
        return {"status": "error", "message": f"Connection failed: {str(e)}", "database_url": _mask_dsn(raw_url)}


# -----------------------------------------------------------------------------
# Улучшенная аутентификация без fallback
# -----------------------------------------------------------------------------
try:
    from liderix_api.routes.auth.deps import get_current_user as _get_current_user
except ImportError:
    try:
        from liderix_api.routes.auth.utils import get_current_user as _get_current_user
    except ImportError:
        try:
            from liderix_api.services.auth import get_current_user as _get_current_user
        except ImportError:
            _get_current_user = None
            logger.error("No auth dependency found - auth required endpoints will fail")


async def _composite_current_user(request: Request):
    if not _get_current_user:
        raise HTTPException(status_code=500, detail="Authentication system not configured")

    try:
        sig = inspect.signature(_get_current_user)
        if "request" in sig.parameters:
            return await _get_current_user(request)
        return await _get_current_user()
    except Exception as e:
        logger.warning(f"Authentication failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication required")


try:
    from pydantic import BaseModel as _BaseModel
except ImportError:
    _BaseModel = object


class _UserMeResponse(_BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_login_at: Optional[str] = None


@app.get(f"{PREFIX}/users/me", tags=["Users"], response_model=_UserMeResponse, name="users:me")
async def get_me(request: Request):
    current_user = await _composite_current_user(request)
    return {
        "id": str(getattr(current_user, "id", "")),
        "email": getattr(current_user, "email", ""),
        "username": getattr(current_user, "username", None),
        "full_name": getattr(current_user, "full_name", None) or getattr(current_user, "name", None),
        "is_active": getattr(current_user, "is_active", True),
        "is_verified": getattr(current_user, "is_verified", True),
        "avatar_url": getattr(current_user, "avatar_url", None),
        "created_at": str(getattr(current_user, "created_at", "")) if getattr(current_user, "created_at", None) else None,
        "updated_at": str(getattr(current_user, "updated_at", "")) if getattr(current_user, "updated_at", None) else None,
        "last_login_at": str(getattr(current_user, "last_login_at", "")) if getattr(current_user, "last_login_at", None) else None,
    }


# -----------------------------------------------------------------------------
# Клиентские роутеры с правильными зависимостями
# -----------------------------------------------------------------------------
from liderix_api.routes.dashboard import overview as dashboard_router  # noqa: E402

app.include_router(
    dashboard_router.router,
    prefix=f"{PREFIX}/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(get_itstep_session)],
)

# --- Опциональные модули ---
try:
    from liderix_api.routes.insights.sales.route import router as insights_sales_router  # noqa: E402
    app.include_router(insights_sales_router, prefix=f"{PREFIX}/insights/sales", tags=["AI Insights"])
    logger.info("AI Insights routes loaded successfully")
except ImportError as e:
    logger.warning(f"Insights routes not loaded: {e}")

try:
    from liderix_api.routes.org_structure import (  # noqa: E402
        org_router,
        departments_router,
        memberships_router,
        invitations_router,
    )
    app.include_router(org_router, prefix=PREFIX, tags=["Organizations"])
    app.include_router(departments_router, prefix=PREFIX, tags=["Departments"])
    app.include_router(memberships_router, prefix=PREFIX, tags=["Memberships"])
    app.include_router(invitations_router, prefix=PREFIX, tags=["Invitations"])
    logger.info("Organization structure routes loaded successfully")
except ImportError as e:
    logger.warning(f"Org-structure routes not loaded: {e}")


# -----------------------------------------------------------------------------
# Error handlers
# -----------------------------------------------------------------------------
def _get_error_title(status_code: int) -> str:
    titles = {
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        422: "Validation Error",
        429: "Too Many Requests",
        500: "Internal Server Error",
    }
    return titles.get(status_code, "HTTP Error")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: FastAPIRequest, exc: HTTPException):
    if isinstance(exc.detail, dict) and "type" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    error_detail = {
        "type": "urn:problem:http-error",
        "title": _get_error_title(exc.status_code),
        "detail": str(exc.detail),
        "status": exc.status_code,
    }
    return JSONResponse(status_code=exc.status_code, content={"detail": error_detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: FastAPIRequest, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append(
            {
                "type": error.get("type", "unknown"),
                "loc": list(error.get("loc", [])),
                "msg": str(error.get("msg", "")),
                "input": str(error.get("input", ""))[:100] if error.get("input") is not None else None,
            }
        )

    error_detail = {
        "type": "urn:problem:validation-error",
        "title": "Validation Error",
        "detail": "Request validation failed",
        "status": 422,
        "errors": errors,
    }
    return JSONResponse(status_code=422, content={"detail": error_detail})


# 🔥 Главное: ловим любые 500 и показываем реальную причину (и в логах будет traceback)
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: FastAPIRequest, exc: Exception):
    request_id = getattr(getattr(request, "state", None), "request_id", None)
    logger.exception("Unhandled error on %s %s (request_id=%s)", request.method, request.url.path, request_id)
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "type": "urn:problem:internal-error",
                "title": "Internal Server Error",
                "detail": str(exc),
                "status": 500,
                "request_id": request_id,
            }
        },
    )


# -----------------------------------------------------------------------------
# Fallback для неизвестных маршрутов API
# -----------------------------------------------------------------------------
@app.api_route(f"{PREFIX}/{{path:path}}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def api_fallback(path: str):
    raise HTTPException(status_code=404, detail=f"API endpoint /{path} not found")


logger.info(f"Application configured with prefix: {PREFIX}")
