import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def notify_job_complete(
    job_id: str,
    job_type: str,
    tenant_id: str,
    twin_id: str,
    status: str = "completed",
    *,
    total_messages: int | None = None,
    processed_messages: int | None = None,
    messages: list[dict[str, Any]] | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    base = settings.laravel_api_url.rstrip("/")
    if not base:
        return

    payload: dict[str, Any] = {
        "job_type": job_type,
        "status": status,
        "tenant_id": tenant_id,
        "twin_id": twin_id,
    }
    if total_messages is not None:
        payload["total_messages"] = total_messages
    if processed_messages is not None:
        payload["processed_messages"] = processed_messages
    if messages is not None:
        payload["messages"] = messages
    if result is not None:
        payload["result"] = result
    if error:
        payload["error"] = error

    url = f"{base}/api/internal/jobs/{job_id}/complete"
    headers = {
        "X-Internal-Secret": settings.ai_engine_secret,
        "X-Tenant": tenant_id,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
    except Exception as exc:
        logger.warning("Laravel callback failed for job %s: %s", job_id, exc)
