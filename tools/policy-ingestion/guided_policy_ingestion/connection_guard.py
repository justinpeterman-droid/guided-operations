from __future__ import annotations

import hmac
import re
from urllib.parse import parse_qs, unquote, urlsplit

from .importers.supabase import ImportErrorSafe

PROJECT_REF_PATTERN = re.compile(r"^[a-z0-9]{20}$")
DIRECT_HOST_PATTERN = re.compile(r"^db\.([a-z0-9]{20})\.supabase\.co$")
POOLER_HOST_PATTERN = re.compile(r"^[a-z0-9.-]+\.pooler\.supabase\.com$")


def require_approved_production_connection(database_url: str, expected_project_ref: str) -> None:
    expected_project_ref = expected_project_ref.strip().lower()
    if not PROJECT_REF_PATTERN.fullmatch(expected_project_ref):
        raise ImportErrorSafe("SUPABASE_PROJECT_REF must be the exact approved Production project reference")
    try:
        parsed = urlsplit(database_url)
        hostname = (parsed.hostname or "").lower()
    except ValueError as error:
        raise ImportErrorSafe("SUPABASE_DB_URL is not a valid PostgreSQL connection URL") from error
    if parsed.scheme not in {"postgres", "postgresql"} or not hostname:
        raise ImportErrorSafe("SUPABASE_DB_URL is not a valid PostgreSQL connection URL")
    query = parse_qs(parsed.query, keep_blank_values=True)
    ssl_modes = {value.lower() for value in query.get("sslmode", [])}
    if ssl_modes & {"disable", "allow", "prefer"}:
        raise ImportErrorSafe("Production policy import does not allow a downgradeable database TLS mode")

    discovered_project_ref: str | None = None
    direct_match = DIRECT_HOST_PATTERN.fullmatch(hostname)
    if direct_match:
        discovered_project_ref = direct_match.group(1)
    elif POOLER_HOST_PATTERN.fullmatch(hostname):
        username = unquote(parsed.username or "").lower()
        if username.startswith("postgres."):
            candidate = username.removeprefix("postgres.")
            if PROJECT_REF_PATTERN.fullmatch(candidate):
                discovered_project_ref = candidate
    if discovered_project_ref is None:
        raise ImportErrorSafe(
            "Controlled Production import requires a direct or pooler URL for the approved Supabase project"
        )
    if not hmac.compare_digest(discovered_project_ref, expected_project_ref):
        raise ImportErrorSafe("SUPABASE_DB_URL does not identify the approved Production Supabase project")
