from fastapi import FastAPI

from .routes.redact import router as redact_router
from .routes.scan import router as scan_router

app = FastAPI(title="BillFlow PII Service", version="1.0.0")

app.include_router(scan_router)
app.include_router(redact_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
