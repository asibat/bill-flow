from fastapi import APIRouter

from ..detect import apply_redactions
from ..models import RedactRequest, RedactResponse

router = APIRouter()


@router.post("/redact", response_model=RedactResponse)
async def redact_text(request: RedactRequest) -> RedactResponse:
    redacted = apply_redactions(
        request.text,
        request.pii_matches,
        request.approved_indices,
    )
    return RedactResponse(redacted_text=redacted)
