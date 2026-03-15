import logging

from fastapi import APIRouter, UploadFile, HTTPException

from ..config import settings
from ..detect import detect_pii
from ..models import ScanResponse
from ..ocr import extract_text

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/scan", response_model=ScanResponse)
async def scan_file(file: UploadFile) -> ScanResponse:
    data = await file.read()

    print(f"[SCAN] filename={file.filename} size={len(data)} content_type={file.content_type} magic={data[:10]}")

    if len(data) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        ocr_result = extract_text(data)
        pii_matches = detect_pii(ocr_result.text)
    except Exception as e:
        logger.exception("OCR/PII detection failed")
        raise HTTPException(status_code=500, detail=str(e))

    return ScanResponse(
        text=ocr_result.text,
        ocr_confidence=ocr_result.confidence,
        language=ocr_result.language,
        pii_matches=pii_matches,
        match_count=len(pii_matches),
    )
