from pydantic import BaseModel


class PiiMatch(BaseModel):
    type: str
    value: str
    start: int
    end: int
    replacement: str


class ScanResponse(BaseModel):
    text: str
    ocr_confidence: float
    language: str
    pii_matches: list[PiiMatch]
    match_count: int


class RedactRequest(BaseModel):
    text: str
    pii_matches: list[PiiMatch]
    approved_indices: list[int] | None = None


class RedactResponse(BaseModel):
    redacted_text: str
