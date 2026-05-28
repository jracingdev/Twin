from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.security import verify_internal_secret
from app.routers import dna, ingest, memory, respond, train, tenant

app = FastAPI(title="TWIN AI Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/ai", tags=["ingest"], dependencies=[Depends(verify_internal_secret)])
app.include_router(dna.router, prefix="/ai", tags=["dna"], dependencies=[Depends(verify_internal_secret)])
app.include_router(respond.router, prefix="/ai", tags=["respond"], dependencies=[Depends(verify_internal_secret)])
app.include_router(memory.router, prefix="/ai", tags=["memory"], dependencies=[Depends(verify_internal_secret)])
app.include_router(train.router, prefix="/ai", tags=["train"], dependencies=[Depends(verify_internal_secret)])
app.include_router(tenant.router, prefix="/ai", tags=["tenant"], dependencies=[Depends(verify_internal_secret)])


@app.get("/health")
def health():
    return {"status": "ok", "service": "twin-ai-engine"}
