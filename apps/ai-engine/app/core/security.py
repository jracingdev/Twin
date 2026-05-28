from fastapi import Header, HTTPException

from app.core.config import settings


def verify_internal_secret(x_internal_secret: str = Header(...)):
    if x_internal_secret != settings.ai_engine_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
