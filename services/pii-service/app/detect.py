"""
PII detection for Belgian bill documents.

Identifies personal information in extracted text and returns
matches with their positions for user review before redaction.
"""

import re
from .models import PiiMatch

# Belgian national number: XX.XX.XX-XXX.XX or XXXXXXXXX-XX
NATIONAL_NUMBER_PATTERNS = [
    re.compile(r"\b\d{2}\.\d{2}\.\d{2}[-–]\d{3}\.\d{2}\b"),
    re.compile(r"\b\d{6}[-–]\d{3}[-–]\d{2}\b"),
    # NN without separators (11 digits starting with valid birth date)
    re.compile(r"\b[0-9]{2}[01]\d[0-3]\d\d{3}\d{2}\b"),
]

# Belgian phone numbers
PHONE_PATTERNS = [
    re.compile(r"(?:\+32|0032)\s*[\d\s./-]{8,12}"),
    re.compile(r"\b0\d[\s./\-]?\d{2,3}[\s./\-]?\d{2}[\s./\-]?\d{2}\b"),
    re.compile(r"\b04\d{2}[\s./\-]?\d{2}[\s./\-]?\d{2}[\s./\-]?\d{2}\b"),
]

# Payment-critical patterns to exclude from PII matches
IBAN_PATTERN = re.compile(r"\b[A-Z]{2}\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{0,4}\b")
STRUCTURED_COMM_PATTERN = re.compile(r"\+{3}\d{3}/\d{4}/\d{5}\+{3}")

# Email addresses
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

# Belgian address patterns
ADDRESS_PATTERNS = [
    # FR: Rue/Avenue/Boulevard + name + number
    re.compile(
        r"(?:Rue|Avenue|Boulevard|Place|Allée|Chemin|Impasse|Chaussée)"
        r"\s+[A-ZÀ-Ü][a-zà-ü]+(?:\s+[a-zà-ü]+)*\s+\d{1,4}(?:\s*[/,]\s*\d{1,4})?\b",
        re.IGNORECASE,
    ),
    # NL: straat/laan/weg/plein + number
    re.compile(
        r"\b[A-ZÀ-Ü][a-zà-ü]+(?:straat|laan|weg|plein|dreef|steenweg|singel)"
        r"\s+\d{1,4}(?:\s*[/,]\s*\d{1,4})?\b",
        re.IGNORECASE,
    ),
    # Postal code + city: 1000 Bruxelles, 1040 ETTERBEEK
    re.compile(
        r"\b[1-9]\d{3}[ \t]+[A-ZÀ-Ü][A-Za-zÀ-ü]+(?:[ \t]+[A-ZÀ-Ü][A-Za-zÀ-ü]+)?\b"
    ),
]

# Name headers in Belgian bills
NAME_HEADER_PATTERNS = [
    # Dutch
    re.compile(
        r"(?:Naam|Klant|Bestemming|Begunstigde|Geadresseerde)\s*:\s*[A-ZÀ-Ü][^\n,]{2,40}",
        re.IGNORECASE,
    ),
    # French
    re.compile(
        r"(?:Nom|Client|Destinataire|Titulaire)\s*:\s*[A-ZÀ-Ü][^\n,]{2,40}",
        re.IGNORECASE,
    ),
    # Standalone all-caps name on its own line (e.g. "AMIR SIBAT" in addressee block)
    # Must be 2-4 words, each 2+ uppercase letters, on its own line
    re.compile(
        r"^[ \t]*([A-ZÀ-Ü]{2,}(?:[ \t]+[A-ZÀ-Ü]{2,}){1,3})[ \t]*$",
        re.MULTILINE,
    ),
]

# Words that look like all-caps names but are not (bill labels, headers)
NAME_EXCLUSIONS = {
    "AVANT LE", "TOTAL", "IBAN", "BIC", "TVA", "TVAC", "HTVA",
    "MONTANT", "EUR", "FACTURE", "UNE QUESTION", "PAYER",
}

REPLACEMENT_MAP: dict[str, str] = {
    "national_number": "[REDACTED_NN]",
    "phone": "[REDACTED_PHONE]",
    "email": "[REDACTED_EMAIL]",
    "address": "[REDACTED_ADDRESS]",
    "name_header": "[REDACTED_NAME]",
}


def _find_matches(
    text: str, patterns: list[re.Pattern[str]], pii_type: str
) -> list[PiiMatch]:
    matches: list[PiiMatch] = []
    for pattern in patterns:
        for m in pattern.finditer(text):
            matches.append(
                PiiMatch(
                    type=pii_type,
                    value=m.group(),
                    start=m.start(),
                    end=m.end(),
                    replacement=REPLACEMENT_MAP[pii_type],
                )
            )
    return matches


def _deduplicate_overlapping(matches: list[PiiMatch]) -> list[PiiMatch]:
    if len(matches) <= 1:
        return matches

    result: list[PiiMatch] = [matches[0]]
    for i in range(1, len(matches)):
        prev = result[-1]
        curr = matches[i]
        if curr.start < prev.end:
            # Overlapping — keep the longer match
            if (curr.end - curr.start) > (prev.end - prev.start):
                result[-1] = curr
        else:
            result.append(curr)
    return result


def _find_protected_ranges(text: str) -> list[tuple[int, int]]:
    """Find ranges of payment-critical fields that should never be flagged as PII."""
    ranges: list[tuple[int, int]] = []
    for m in IBAN_PATTERN.finditer(text):
        ranges.append((m.start(), m.end()))
    for m in STRUCTURED_COMM_PATTERN.finditer(text):
        ranges.append((m.start(), m.end()))
    return ranges


def _overlaps_protected(match: PiiMatch, protected: list[tuple[int, int]]) -> bool:
    for start, end in protected:
        if match.start < end and match.end > start:
            return True
    return False


def detect_pii(text: str) -> list[PiiMatch]:
    """Detect PII in text. Returns all matches sorted by position."""
    matches: list[PiiMatch] = []

    matches.extend(_find_matches(text, NATIONAL_NUMBER_PATTERNS, "national_number"))
    matches.extend(_find_matches(text, PHONE_PATTERNS, "phone"))
    matches.extend(_find_matches(text, [EMAIL_PATTERN], "email"))
    matches.extend(_find_matches(text, ADDRESS_PATTERNS, "address"))
    matches.extend(_find_matches(text, NAME_HEADER_PATTERNS, "name_header"))

    # Filter out all-caps "names" that are actually bill labels
    matches = [
        m for m in matches
        if not (m.type == "name_header" and m.value.strip() in NAME_EXCLUSIONS)
    ]

    # Filter out matches that overlap with IBANs or structured communications
    protected = _find_protected_ranges(text)
    matches = [m for m in matches if not _overlaps_protected(m, protected)]

    matches.sort(key=lambda m: m.start)
    return _deduplicate_overlapping(matches)


def apply_redactions(
    text: str,
    matches: list[PiiMatch],
    approved_indices: list[int] | None = None,
) -> str:
    """Apply redactions to text. Only redacts approved matches (or all if none specified)."""
    to_redact = (
        [m for i, m in enumerate(matches) if i in approved_indices]
        if approved_indices is not None
        else matches
    )

    # Apply from end to start to preserve positions
    result = text
    for m in reversed(to_redact):
        result = result[: m.start] + m.replacement + result[m.end :]
    return result
