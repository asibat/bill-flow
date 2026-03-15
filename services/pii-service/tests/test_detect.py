"""Tests for PII detection and redaction — ported from __tests__/pii/detect.test.ts."""

from app.detect import apply_redactions, detect_pii


# --- National numbers ---


def test_detects_belgian_nn_dotted_format():
    matches = detect_pii("Client NN: 85.07.15-123.45 est enregistré")
    nn = [m for m in matches if m.type == "national_number"]
    assert len(nn) >= 1
    assert nn[0].value == "85.07.15-123.45"


def test_detects_nn_dashed_format():
    matches = detect_pii("Rijksregisternummer: 850715-123-45")
    assert any(m.type == "national_number" for m in matches)


# --- Phone numbers ---


def test_detects_plus32_format():
    matches = detect_pii("Bel ons op +32 2 123 45 67")
    assert any(m.type == "phone" for m in matches)


def test_detects_belgian_mobile():
    matches = detect_pii("GSM: 0478 12 34 56")
    assert any(m.type == "phone" for m in matches)


def test_detects_landline_with_dots():
    matches = detect_pii("Tel: 02.123.45.67")
    assert any(m.type == "phone" for m in matches)


# --- Email addresses ---


def test_detects_standard_email():
    matches = detect_pii("Contact: jan.peeters@example.be")
    email = [m for m in matches if m.type == "email"]
    assert len(email) >= 1
    assert email[0].value == "jan.peeters@example.be"


def test_detects_email_with_plus():
    matches = detect_pii("jan+bills@gmail.com")
    assert any(m.type == "email" for m in matches)


# --- Addresses ---


def test_detects_french_street():
    matches = detect_pii("Rue de la Loi 16")
    assert any(m.type == "address" for m in matches)


def test_detects_dutch_street():
    matches = detect_pii("Wetstraat 16")
    assert any(m.type == "address" for m in matches)


def test_detects_postal_code_city():
    matches = detect_pii("1000 Bruxelles")
    assert any(m.type == "address" for m in matches)


def test_detects_avenue_pattern():
    matches = detect_pii("Avenue Louise 123")
    assert any(m.type == "address" for m in matches)


# --- Name headers ---


def test_detects_dutch_name_header():
    matches = detect_pii("Naam: Jan Peeters")
    assert any(m.type == "name_header" for m in matches)


def test_detects_french_name_header():
    matches = detect_pii("Nom: Jean Dupont")
    assert any(m.type == "name_header" for m in matches)


def test_detects_destinataire_header():
    matches = detect_pii("Destinataire: Marie Lambert")
    assert any(m.type == "name_header" for m in matches)


# --- Payment-critical fields (should NOT be flagged) ---


def test_does_not_flag_iban():
    matches = detect_pii("IBAN: BE40310083000663")
    assert not any("BE40310083000663" in m.value for m in matches)


def test_does_not_flag_digits_inside_iban():
    matches = detect_pii("IBAN BE52 0960 1178 4309")
    assert len(matches) == 0


def test_does_not_flag_structured_comm():
    matches = detect_pii("Communication: +++260/2754/48343+++")
    assert not any("260/2754/48343" in m.value for m in matches)


def test_does_not_flag_amounts():
    matches = detect_pii("Montant: 44,25 EUR")
    assert len(matches) == 0


# --- Mixed content ---


def test_detects_multiple_pii_types():
    text = """
        Facture pour Jan Peeters
        Nom: Jan Peeters
        Adresse: Rue de la Loi 16
        1000 Bruxelles
        Email: jan@example.be
        Tel: +32 2 123 45 67
        NN: 85.07.15-123.45

        Montant: 44,25 EUR
        IBAN: BE40310083000663
        Communication: +++260/2754/48343+++
    """
    matches = detect_pii(text)
    types = {m.type for m in matches}
    assert "national_number" in types
    assert "phone" in types
    assert "email" in types
    assert "address" in types
    assert "name_header" in types


def test_empty_for_no_pii():
    matches = detect_pii("TOTAL: 44,25 EUR - IBAN BE40310083000663")
    assert len(matches) == 0


# --- Deduplication ---


def test_deduplicates_overlapping_matches():
    matches = detect_pii("Contact: +32 478 12 34 56")
    phone_matches = [m for m in matches if m.type == "phone"]
    for i in range(1, len(phone_matches)):
        assert phone_matches[i].start >= phone_matches[i - 1].end


# --- Redaction ---


def test_redacts_all_when_no_approved_indices():
    text = "Email: jan@example.be, Tel: +32 2 123 45 67"
    matches = detect_pii(text)
    redacted = apply_redactions(text, matches)
    assert "[REDACTED_EMAIL]" in redacted
    assert "[REDACTED_PHONE]" in redacted
    assert "jan@example.be" not in redacted


def test_redacts_only_approved_indices():
    text = "Email: jan@example.be, Tel: +32 2 123 45 67"
    matches = detect_pii(text)
    email_idx = next(i for i, m in enumerate(matches) if m.type == "email")
    redacted = apply_redactions(text, matches, [email_idx])
    assert "[REDACTED_EMAIL]" in redacted
    assert "[REDACTED_PHONE]" not in redacted


def test_returns_original_when_no_matches():
    text = "TOTAL: 44,25 EUR"
    assert apply_redactions(text, []) == text


def test_preserves_text_around_redactions():
    text = "Facture - Email: jan@example.be - Merci"
    matches = detect_pii(text)
    redacted = apply_redactions(text, matches)
    assert "Facture - Email:" in redacted
    assert "- Merci" in redacted
