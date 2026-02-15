from __future__ import annotations

import logging
from typing import Optional

from redis.asyncio import Redis

from liderix_api.config.settings import settings

logger = logging.getLogger(__name__)


def get_redis_client(*, decode_responses: bool = False) -> Optional[Redis]:
    url = getattr(settings, "REDIS_URL", None)
    if not url:
        logger.warning("REDIS_URL is not set — Redis features disabled.")
        return None

    try:
        return Redis.from_url(
            url,
            decode_responses=decode_responses,
            socket_connect_timeout=1,
            socket_timeout=1,
            retry_on_timeout=False,
        )
    except Exception as exc:
        logger.warning("Redis init failed — Redis features disabled: %s", exc)
        return None
