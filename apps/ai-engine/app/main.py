from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.security import verify_internal_secret
from app.routers import dna, feedback, ingest, memory, playbooks, replay, respond, train, tenant

app = FastAPI(title="TWIN AI Engine", version="1.0.0")

_cors_origins = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

app.include_router(ingest.router, prefix="/ai", tags=["ingest"], dependencies=[Depends(verify_internal_secret)])
app.include_router(dna.router, prefix="/ai", tags=["dna"], dependencies=[Depends(verify_internal_secret)])
app.include_router(respond.router, prefix="/ai", tags=["respond"], dependencies=[Depends(verify_internal_secret)])
app.include_router(feedback.router, prefix="/ai", tags=["feedback"], dependencies=[Depends(verify_internal_secret)])
app.include_router(memory.router, prefix="/ai", tags=["memory"], dependencies=[Depends(verify_internal_secret)])
app.include_router(playbooks.router, prefix="/ai", tags=["playbooks"], dependencies=[Depends(verify_internal_secret)])
app.include_router(train.router, prefix="/ai", tags=["train"], dependencies=[Depends(verify_internal_secret)])
app.include_router(replay.router, prefix="/ai", tags=["replay"], dependencies=[Depends(verify_internal_secret)])
app.include_router(tenant.router, prefix="/ai", tags=["tenant"], dependencies=[Depends(verify_internal_secret)])


@app.get("/health")
def health():
    return {"status": "ok", "service": "twin-ai-engine"}
