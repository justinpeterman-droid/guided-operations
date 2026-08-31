"""Describe failures precisely without printing policy content.

Three places in this tool used to answer a failure with some variant of
"private details were not printed". That silence cost more than it protected:
a one-word mistake became undiagnosable against a production database, and an
operator was left with a failure count and no cause.

The rule these helpers follow is that structure is safe and content is not.
A Postgres error code, table, column and constraint name describe the schema,
which is in the repository already. The message body can quote the offending
row value, so it is withheld. An OSError names the file it choked on, so only
its errno is reported.
"""

from __future__ import annotations

_MAX_DETAIL = 200


def safe_database_detail(error: BaseException) -> str:
    """Name a database failure without echoing message text or local paths."""
    parts: list[str] = [type(error).__name__]
    sqlstate = getattr(error, "sqlstate", None)
    if sqlstate:
        parts.append(f"code {sqlstate}")
    diagnostics = getattr(error, "diag", None)
    for label, attribute in (
        ("table", "table_name"),
        ("column", "column_name"),
        ("constraint", "constraint_name"),
    ):
        value = getattr(diagnostics, attribute, None) if diagnostics else None
        if value:
            parts.append(f"{label} {value}")
    if len(parts) == 1 and isinstance(error, OSError) and error.errno is not None:
        parts.append(f"errno {error.errno}")
    return "; ".join(parts)


def safe_pipeline_reason(error: BaseException) -> str:
    """Name a pipeline failure without printing a source path."""
    name = type(error).__name__
    if isinstance(error, OSError):
        return f"{name}; errno {error.errno}"
    detail = _first_line(error)
    return f"{name}: {detail}" if detail else name


def _first_line(error: BaseException) -> str:
    text = str(error).strip()
    return text.splitlines()[0][:_MAX_DETAIL] if text else ""
