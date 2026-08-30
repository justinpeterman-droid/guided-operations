from __future__ import annotations

import re
from collections.abc import Mapping

APPROVED_RETENTION_MODES = frozenset(
    {
        "zero_data_retention",
        "modified_abuse_monitoring",
        "enhanced_zero_data_retention",
        "enhanced_modified_abuse_monitoring",
    }
)


def require_approved_openai_data_controls(environment: Mapping[str, str]) -> None:
    approval_ref = environment.get("OPENAI_DATA_CONTROLS_APPROVAL_REF", "").strip()
    retention_mode = environment.get("OPENAI_DATA_RETENTION_MODE", "").strip()
    data_sharing = environment.get("OPENAI_API_DATA_SHARING_ENABLED", "").strip()
    if (
        re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:/-]{1,159}", approval_ref) is None
        or retention_mode not in APPROVED_RETENTION_MODES
        or data_sharing != "false"
    ):
        raise ValueError("Approved OpenAI data controls are required")
