from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional

import httpx

from liderix_api.config.settings import settings

logger = logging.getLogger(__name__)


class OpenAIError(RuntimeError):
    pass


class OpenAIClient:
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1") -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    async def chat_completion(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str | Dict[str, Any]] = None,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
        if tool_choice:
            payload["tool_choice"] = tool_choice

        return await self._post("/chat/completions", payload)

    async def embeddings(self, *, model: str, inputs: Iterable[str]) -> List[List[float]]:
        payload = {"model": model, "input": list(inputs)}
        response = await self._post("/embeddings", payload)
        data = response.get("data", [])
        return [item.get("embedding", []) for item in data]

    async def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                logger.error("OpenAI request failed: %s", exc)
                raise OpenAIError("OpenAI request failed") from exc
        return response.json()


class QdrantError(RuntimeError):
    pass


class QdrantClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def ensure_collection(self, name: str, vector_size: int) -> None:
        if not name:
            return
        url = f"{self.base_url}/collections/{name}"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, headers=self._headers())
            if response.status_code == 200:
                return
            if response.status_code not in (404, 400):
                logger.warning("Qdrant collection check failed: %s", response.text)
                return
            payload = {"vectors": {"size": vector_size, "distance": "Cosine"}}
            created = await client.put(url, json=payload, headers=self._headers())
            if created.status_code >= 300:
                logger.warning("Qdrant collection create failed: %s", created.text)

    async def upsert_points(
        self,
        *,
        collection: str,
        points: List[Dict[str, Any]],
    ) -> None:
        if not collection:
            return
        url = f"{self.base_url}/collections/{collection}/points"
        payload = {"points": points}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.put(url, json=payload, headers=self._headers())
            if response.status_code >= 300:
                logger.warning("Qdrant upsert failed: %s", response.text)

    async def search(
        self,
        *,
        collection: str,
        vector: List[float],
        limit: int = 5,
        filter_payload: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not collection:
            return []
        url = f"{self.base_url}/collections/{collection}/points/search"
        payload: Dict[str, Any] = {"vector": vector, "limit": limit}
        if filter_payload:
            payload["filter"] = filter_payload
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=self._headers())
            if response.status_code >= 300:
                logger.warning("Qdrant search failed: %s", response.text)
                return []
            data = response.json()
            return data.get("result", [])

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            return {}
        return {"api-key": self.api_key}


def get_openai_client() -> Optional[OpenAIClient]:
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAIClient(api_key=settings.OPENAI_API_KEY)


def get_qdrant_client() -> Optional[QdrantClient]:
    if not settings.QDRANT_URL:
        return None
    return QdrantClient(base_url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)

