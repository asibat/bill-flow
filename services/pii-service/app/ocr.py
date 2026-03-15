"""
Text extraction module.
- PDFs: pdfplumber (direct text extraction, no OCR needed)
- Images: EasyOCR (deep learning based, pure Python, no system dependencies)
"""

from dataclasses import dataclass
from io import BytesIO

import easyocr
import numpy as np
import pdfplumber
from PIL import Image

from .config import settings

# Lazily initialized — first call loads the model (~1-2s), subsequent calls reuse it
_reader: easyocr.Reader | None = None


def _get_reader(languages: list[str]) -> easyocr.Reader:
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(languages, gpu=False)
    return _reader


@dataclass
class OcrResult:
    text: str
    confidence: float
    language: str


def is_pdf(data: bytes) -> bool:
    # Check first 16 bytes — some PDFs have a BOM prefix (\xef\xbb\xbf)
    return b"%PDF-" in data[:16]


def extract_from_pdf(data: bytes) -> OcrResult:
    # Strip BOM if present
    if data[:3] == b"\xef\xbb\xbf":
        data = data[3:]
    pages_text: list[str] = []
    with pdfplumber.open(BytesIO(data)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
    return OcrResult(
        text="\n".join(pages_text),
        confidence=settings.pdf_confidence,
        language="unknown",
    )


def extract_from_image(data: bytes, languages: list[str]) -> OcrResult:
    image = Image.open(BytesIO(data))
    img_array = np.array(image)

    reader = _get_reader(languages)
    results = reader.readtext(img_array)

    # results = list of (bbox, text, confidence)
    texts: list[str] = []
    confidences: list[float] = []
    for _bbox, text, confidence in results:
        texts.append(text)
        confidences.append(confidence)

    avg_confidence = (
        sum(confidences) / len(confidences) * 100 if confidences else 0.0
    )

    return OcrResult(
        text="\n".join(texts),
        confidence=avg_confidence,
        language="+".join(languages),
    )


def extract_text(data: bytes, languages: list[str] | None = None) -> OcrResult:
    langs = languages or settings.ocr_languages
    if is_pdf(data):
        return extract_from_pdf(data)
    return extract_from_image(data, langs)
