#!/usr/bin/env python3
"""Token-redaction helper for the ai-padrao harness.

Reads a single JSON object from stdin (a Claude Code hook payload), strips
sensitive material (auth tokens, secrets, environment-derived credentials),
and writes the sanitized JSON to stdout. Used by `.harness/capture.sh` and
also exposed as a CLI for ad-hoc redaction.

The redaction is intentionally conservative — anything that even LOOKS like
a token or secret gets masked. False positives are acceptable; false
negatives are not.

Usage:
    python3 .harness/redact.py < payload.json > redacted.json
    echo '{"command": "GH_TOKEN=ghp_abc123..."}' | python3 .harness/redact.py
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any


# Variable names whose VALUES must always be redacted.
_SECRET_VAR_NAMES: tuple[str, ...] = (
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "GITHUB_PERSONAL_ACCESS_TOKEN",
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "OPENAI_API_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ACCESS_KEY_ID",
    "GCP_SERVICE_ACCOUNT_KEY",
    "DATABASE_URL",
    "DIRECT_URL",
    "JWT_SECRET",
    "SESSION_SECRET",
    "COOKIE_SECRET",
    "ARGON2_SECRET",
    "SMTP_PASSWORD",
    "OTEL_EXPORTER_OTLP_HEADERS",
)


# Regexes for raw secret-shaped strings. Order matters: longer / more
# specific patterns first so they shadow the catch-all.
_SECRET_VALUE_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Anthropic
    re.compile(r"sk-ant-[A-Za-z0-9_\-]+"),
    re.compile(r"sk-cp-[A-Za-z0-9_\-]+"),
    # GitHub
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"gho_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"glpat-[A-Za-z0-9_\-]{20,}"),
    # OpenAI
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    # AWS
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"aws_secret_access_key=[A-Za-z0-9/+=]{40}"),
    # JWT (three base64url segments)
    re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"),
    # Stripe
    re.compile(r"sk_live_[A-Za-z0-9]{20,}"),
    re.compile(r"rk_live_[A-Za-z0-9]{20,}"),
    # Slack
    re.compile(r"xox[baprs]-[A-Za-z0-9\-]{10,}"),
    # Argon2 / bcrypt / sha hashes (long, opaque)
    re.compile(r"\$argon2(?:id|i)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]{40,}"),
    # Generic 40+ char base64 / hex strings (no path separator — keep `/` out
    # of the class so file paths like `/home/leo/Documentos/projetos/padrao/AGENTS.md`
    # don't get caught as a single 42-char run).
    re.compile(r"\b[A-Za-z0-9+]{40,}={0,2}\b"),
)


# Regex for `KEY=value` form. Three variants matched:
#   - bare:        JWT_SECRET=abc123
#   - double-quoted: JWT_SECRET="abc 123"
#   - single-quoted: JWT_SECRET='abc 123'
# The value group may NOT contain the closing quote (we want the whole token
# inside the quotes, including any spaces).
_ASSIGNMENT_RE = re.compile(
    r"(" + "|".join(re.escape(n) for n in _SECRET_VAR_NAMES) + r")\s*=\s*"
    r"(?:"
        r"([^'\"\s;&|<>`][^\s;&|<>`]*)"          # bare (no whitespace, no quotes)
        r"|\"([^\"]*)\""                          # double-quoted
        r"|'([^']*)'"                             # single-quoted
    r")"
)


def _redact_string(value: str) -> str:
    """Mask secret-shaped substrings inside an arbitrary string."""
    out = value
    for pat in _SECRET_VALUE_PATTERNS:
        out = pat.sub("***REDACTED***", out)
    out = _ASSIGNMENT_RE.sub(
        lambda m: f"{m.group(1)}=***REDACTED***",
        out,
    )
    return out


def _redact(obj: Any) -> Any:
    if isinstance(obj, dict):
        new: dict[str, Any] = {}
        for k, v in obj.items():
            if k.upper() in _SECRET_VAR_NAMES or any(
                token in k.upper() for token in ("TOKEN", "SECRET", "PASSWORD", "KEY", "AUTH")
            ):
                new[k] = "***REDACTED***"
            else:
                new[k] = _redact(v)
        return new
    if isinstance(obj, list):
        return [_redact(v) for v in obj]
    if isinstance(obj, str):
        return _redact_string(obj)
    return obj


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        sys.exit(0)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        # Non-JSON input — treat as plain text and redact as a string.
        sys.stdout.write(json.dumps({"raw": _redact_string(raw)}))
        sys.stdout.write("\n")
        return 0
    redacted = _redact(payload)
    sys.stdout.write(json.dumps(redacted, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    main()