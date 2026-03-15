"""Tests for API routes."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_redact_endpoint():
    res = client.post(
        "/redact",
        json={
            "text": "Email: jan@example.be end",
            "pii_matches": [
                {
                    "type": "email",
                    "value": "jan@example.be",
                    "start": 7,
                    "end": 21,
                    "replacement": "[REDACTED_EMAIL]",
                }
            ],
            "approved_indices": None,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "[REDACTED_EMAIL]" in data["redacted_text"]
    assert "jan@example.be" not in data["redacted_text"]


def test_redact_partial():
    res = client.post(
        "/redact",
        json={
            "text": "Email: jan@example.be Tel: 0478123456",
            "pii_matches": [
                {
                    "type": "email",
                    "value": "jan@example.be",
                    "start": 7,
                    "end": 21,
                    "replacement": "[REDACTED_EMAIL]",
                },
                {
                    "type": "phone",
                    "value": "0478123456",
                    "start": 27,
                    "end": 37,
                    "replacement": "[REDACTED_PHONE]",
                },
            ],
            "approved_indices": [0],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "[REDACTED_EMAIL]" in data["redacted_text"]
    assert "0478123456" in data["redacted_text"]


def test_scan_empty_file():
    from io import BytesIO

    res = client.post("/scan", files={"file": ("empty.txt", BytesIO(b""), "text/plain")})
    assert res.status_code == 400
