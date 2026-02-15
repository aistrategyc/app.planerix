# apps/api/liderix_api/middleware/security.py
from __future__ import annotations

import logging
import time
from typing import Optional, Iterable
from urllib.parse import urlparse

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp

from liderix_api.config.settings import settings
from liderix_api.services.redis_client import get_redis_client

logger = logging.getLogger(__name__)


# -------------------------
# helpers
# -------------------------
def _normalize_endpoint(path: str) -> str:
    """
    Приводим путь к виду без API_PREFIX:
    '/api/auth/login' -> '/auth/login'
    """
    prefix = (getattr(settings, "API_PREFIX", "") or "").rstrip("/")
    if prefix and path.startswith(prefix + "/"):
        return path[len(prefix):]
    return path


def _problem(status_code: int, type_: str, title: str, detail: str) -> JSONResponse:
    """
    Единый формат ошибок для middleware (и чтобы НЕ было ExceptionGroup/500).
    """
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": {
                "type": type_,
                "title": title,
                "detail": detail,
                "status": status_code,
            }
        },
    )


def _is_dev_mode() -> bool:
    env = (getattr(settings, "ENVIRONMENT", "") or "").lower()
    debug = bool(getattr(settings, "DEBUG", False))
    return debug or env in {"dev", "development", "local"}


def _iter_allowed_origins() -> Iterable[str]:
    cors = getattr(settings, "CORS_ALLOW_ORIGINS", None) or []
    fe = getattr(settings, "FRONTEND_URL", None)
    for x in cors:
        if x:
            yield x
    if fe:
        yield fe


def _host_ok(url: Optional[str], allowed_origins: set[str]) -> bool:
    if not url:
        return False
    try:
        parsed = urlparse(url)
        host = parsed.netloc
    except Exception:
        return False

    # 1) exact match (полный origin)
    if url in allowed_origins:
        return True

    # 2) match by host (origin's host == allowed origin host)
    for a in allowed_origins:
        try:
            ah = urlparse(a).netloc
        except Exception:
            continue
        if not ah:
            continue
        if host == ah or host.endswith("." + ah.lstrip(".")):
            return True

    return False


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware для auth-эндпоинтов.

    - Rate limiting (если Redis включен)
    - Rapid-fire детекция (если Redis включен)
    - CSRF check (вменяемый, без убийства curl/dev)
    - Лимит размера тела
    - Заголовки безопасности + метрики (best-effort)
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.redis: Optional[Redis] = get_redis_client()

        # Усиленные лимиты (можно править)
        self.rate_limits = {
            "/auth/register": {"requests": 5, "window": 3600},       # 5 регистраций в час
            "/auth/login": {"requests": 20, "window": 900},          # 20 попыток входа за 15 минут
            "/auth/resend-verification": {"requests": 3, "window": 3600},
            "/auth/refresh": {"requests": 50, "window": 3600},
            "/auth/verify": {"requests": 10, "window": 3600},
            "/auth/logout": {"requests": 30, "window": 3600},
            "/auth/password-reset": {"requests": 3, "window": 3600},
        }

        self.suspicious_thresholds = {
            "rapid_fire_per_minute": 30,
            "failed_logins_per_hour": 10,
            "registrations_per_hour": 3,
        }

        self.max_auth_body_bytes = 1 * 1024 * 1024  # 1 MB

        # CSRF:
        # refresh мы делаем exempt по умолчанию, т.к. refresh cookie у тебя SameSite=Lax,
        # а значит cross-site POST не притащит cookie -> CSRF атака на refresh не работает.
        self.csrf_exempt_paths = {
            "/auth/login",
            "/auth/register",
            "/auth/verify",
            "/auth/resend-verification",
            "/auth/password-reset",
            "/auth/refresh",     # ✅ ключевой фикс твоей ошибки
        }

    async def dispatch(self, request: Request, call_next):
        start_ts = time.time()

        raw_path = request.url.path
        path = _normalize_endpoint(raw_path)
        method = request.method
        client_ip = self._get_client_ip(request)

        try:
            # pre-checks только для /auth/*
            if path.startswith("/auth/"):
                await self._pre_auth_checks(request, client_ip, path, method)

            response: Response = await call_next(request)

            # post-observe только для /auth/*
            if path.startswith("/auth/"):
                await self._post_auth_observe(client_ip, path, response.status_code)

            self._add_security_headers(response, request, path)

            # метрики — best-effort
            await self._log_metrics(path, method, response.status_code, time.time() - start_ts)

            return response

        except HTTPException as exc:
            # ✅ ВАЖНО: внутри BaseHTTPMiddleware лучше НЕ raise,
            # иначе Starlette может завернуть в ExceptionGroup => 500.
            resp = _problem(
                status_code=exc.status_code,
                type_=str(getattr(exc, "detail", {}).get("type", "urn:problem:http-exception"))
                if isinstance(getattr(exc, "detail", None), dict)
                else "urn:problem:http-exception",
                title=str(getattr(exc, "detail", {}).get("title", "Request Failed"))
                if isinstance(getattr(exc, "detail", None), dict)
                else "Request Failed",
                detail=str(getattr(exc, "detail", {}).get("detail", exc.detail))
                if isinstance(getattr(exc, "detail", None), dict)
                else str(exc.detail),
            )
            self._add_security_headers(resp, request, path)
            await self._log_metrics(path, method, exc.status_code, time.time() - start_ts)
            return resp

        except Exception as e:
            logger.exception("Security middleware error: %s", e)

            # В dev/local — НЕ прячем реальную ошибку, иначе невозможно отладить auth
            if _is_dev_mode():
                raise

            resp = _problem(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                type_="urn:problem:internal-security-error",
                title="Internal security error",
                detail="Internal security error",
            )
            self._add_security_headers(resp, request, path)
            await self._log_metrics(path, method, 500, time.time() - start_ts)
            return resp

    async def _pre_auth_checks(self, request: Request, client_ip: str, path: str, method: str) -> None:
        if method == "OPTIONS":
            return
        if _is_dev_mode():
            return
        await self._check_rate_limit(client_ip, path)
        await self._check_request_size(request)
        await self._check_rapid_fire(client_ip)

        if path == "/auth/register":
            await self._track_registrations(client_ip)

        # CSRF: только для state-changing операций и только если endpoint не exempt
        if method in {"POST", "PUT", "PATCH", "DELETE"} and path not in self.csrf_exempt_paths:
            await self._check_csrf(request, path)

    async def _check_rate_limit(self, client_ip: str, path: str) -> None:
        if not self.redis:
            return

        conf = self.rate_limits.get(path)
        if not conf:
            return

        key = f"rate_limit:{path}:{client_ip}"
        try:
            current = await self.redis.incr(key)
            if current == 1:
                await self.redis.expire(key, conf["window"])
        except (RedisConnectionError, RedisError) as exc:
            logger.warning("Redis rate limit disabled: %s", exc)
            self.redis = None
            return

        if current > conf["requests"]:
            logger.warning("Rate limit exceeded: ip=%s path=%s (%s/%s)", client_ip, path, current, conf["requests"])
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "type": "urn:problem:rate-limit",
                    "title": "Rate Limit Exceeded",
                    "detail": f"Too many requests to {path}. Try again later.",
                    "status": 429,
                },
            )

    async def _check_request_size(self, request: Request) -> None:
        length = request.headers.get("content-length")
        if not length:
            return
        try:
            size = int(length)
        except ValueError:
            return

        if size > self.max_auth_body_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "type": "urn:problem:request-too-large",
                    "title": "Request Too Large",
                    "detail": "Request body exceeds maximum allowed size",
                    "status": 413,
                },
            )

    async def _check_rapid_fire(self, client_ip: str) -> None:
        if not self.redis:
            return

        key = f"rapid_fire:{client_ip}"
        try:
            count = await self.redis.incr(key)
            if count == 1:
                await self.redis.expire(key, 60)
        except (RedisConnectionError, RedisError) as exc:
            logger.warning("Redis rapid-fire check disabled: %s", exc)
            self.redis = None
            return

        if count > self.suspicious_thresholds["rapid_fire_per_minute"]:
            logger.warning("Rapid fire detected: ip=%s count=%s/min", client_ip, count)
            await self._flag_suspicious_ip(client_ip, "rapid_fire")

    async def _track_registrations(self, client_ip: str) -> None:
        if not self.redis:
            return

        key = f"registrations:{client_ip}"
        try:
            count = await self.redis.incr(key)
            if count == 1:
                await self.redis.expire(key, 3600)
        except (RedisConnectionError, RedisError) as exc:
            logger.warning("Redis registration tracking disabled: %s", exc)
            self.redis = None
            return

        if count > self.suspicious_thresholds["registrations_per_hour"]:
            logger.warning("Excessive registrations: ip=%s count=%s/h", client_ip, count)
            await self._flag_suspicious_ip(client_ip, "excessive_registrations")

    async def _check_csrf(self, request: Request, path: str) -> None:
        """
        Нормальная CSRF-логика:

        ✅ CSRF НЕ нужен, если:
        - есть Authorization header (Bearer/JWT)
        - запрос не из браузера (dev-mode: нет Origin/Referer)
        - запрос с allowlisted Origin/Referer

        В ПРОДЕ:
        - если Origin/Referer отсутствуют => считаем подозрительным и блокируем
          (это защищает от "странных" cookie-based POST без контекста)
        """
        # Authorization => CSRF не нужен
        if request.headers.get("authorization"):
            return

        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        allowed = set(_iter_allowed_origins())

        # Если пришёл браузерный origin/referer — проверяем allowlist
        if origin and _host_ok(origin, allowed):
            return
        if referer and _host_ok(referer, allowed):
            return

        # Нет origin/referer:
        # - в dev разрешаем (чтобы curl/local tools работали)
        # - в prod запрещаем
        if not origin and not referer:
            if _is_dev_mode():
                return

        logger.warning("CSRF validation failed: path=%s origin=%s referer=%s", path, origin, referer)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "type": "urn:problem:csrf-validation-failed",
                "title": "CSRF Validation Failed",
                "detail": "Request failed CSRF validation",
                "status": 403,
            },
        )

    async def _post_auth_observe(self, client_ip: str, path: str, status_code: int) -> None:
        if not self.redis:
            return

        try:
            if path in {"/auth/login", "/auth/verify"} and status_code in (401, 403):
                key = f"auth_failures:{client_ip}"
                fails = await self.redis.incr(key)
                if fails == 1:
                    await self.redis.expire(key, 3600)

                if fails > self.suspicious_thresholds["failed_logins_per_hour"]:
                    logger.warning("Excessive auth failures: ip=%s fails=%s", client_ip, fails)
                    await self._flag_suspicious_ip(client_ip, "excessive_auth_failures")

            elif path == "/auth/login" and status_code == 200:
                await self.redis.delete(f"auth_failures:{client_ip}")
        except (RedisConnectionError, RedisError) as exc:
            logger.warning("Redis auth observe disabled: %s", exc)
            self.redis = None
            return

    def _get_client_ip(self, request: Request) -> str:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        xri = request.headers.get("x-real-ip")
        if xri:
            return xri
        return request.client.host if request.client else "unknown"

    async def _flag_suspicious_ip(self, client_ip: str, reason: str) -> None:
        if not self.redis:
            return
        key = f"suspicious_ip:{client_ip}"
        try:
            await self.redis.setex(key, 3600, reason)
        except (RedisConnectionError, RedisError) as exc:
            logger.warning("Redis suspicious-ip flag disabled: %s", exc)
            self.redis = None
            return
        logger.error("Suspicious IP flagged: ip=%s reason=%s", client_ip, reason)

    def _add_security_headers(self, response: Response, request: Request, path: str) -> None:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # CSP только на auth
        if path.startswith("/auth/"):
            csp = (
                "default-src 'none'; "
                "img-src 'self' data: https:; "
                "style-src 'self' 'unsafe-inline'; "
                "script-src 'self' 'unsafe-inline'; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )
            response.headers["Content-Security-Policy"] = csp

        origin = request.headers.get("origin")
        if origin:
            allowed = set(_iter_allowed_origins())
            if _host_ok(origin, allowed):
                response.headers.setdefault("Access-Control-Allow-Origin", origin)
                response.headers.setdefault("Vary", "Origin")
                response.headers.setdefault("Access-Control-Allow-Credentials", "true")
                response.headers.setdefault(
                    "Access-Control-Expose-Headers",
                    "X-Request-ID, Content-Type, Authorization",
                )

    async def _log_metrics(self, path: str, method: str, status_code: int, dt: float) -> None:
        if not self.redis:
            return

        key = f"metrics:{path}:{method}"
        try:
            await self.redis.hincrby(key, "count", 1)
            await self.redis.hincrby(key, f"status_{status_code}", 1)

            avg_key = f"{key}:avg_time"
            cur = await self.redis.get(avg_key)
            try:
                new_avg = (float(cur) + dt) / 2.0 if cur else dt
            except Exception:
                new_avg = dt

            await self.redis.setex(avg_key, 3600, str(new_avg))
            await self.redis.expire(key, 86400)
        except Exception as exc:
            logger.warning("Redis metrics disabled: %s", exc)
            self.redis = None


def add_security_middleware(app: ASGIApp) -> None:
    """Подключение middleware к приложению FastAPI."""
    app.add_middleware(SecurityMiddleware)
