from __future__ import annotations

from typing import Any, Dict, Optional

from httpx import AsyncClient, HTTPError

from liderix_api.config.settings import settings


class N8NError(RuntimeError):
    pass


class N8NClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"X-N8N-API-KEY": self.api_key}
        async with AsyncClient(timeout=30.0) as client:
            try:
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    json=json,
                    params=params,
                )
            except HTTPError as exc:
                raise N8NError(f"n8n request failed: {exc}") from exc

        if response.status_code >= 400:
            raise N8NError(f"n8n error {response.status_code}: {response.text}")
        return response.json()


def get_n8n_client() -> N8NClient:
    if not settings.N8N_API_URL or not settings.N8N_API_KEY:
        raise N8NError("n8n is not configured")
    return N8NClient(settings.N8N_API_URL, settings.N8N_API_KEY)
