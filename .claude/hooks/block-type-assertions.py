#!/usr/bin/env python3
"""PreToolUse guard: block Write/Edit/MultiEdit that introduces TS escape hatches.

Blocks the operation if the new content for a .ts/.tsx/.mts/.cts file contains:
  - `as any`
  - `as unknown` (including `as unknown as T`)
  - `@ts-ignore`
  - `@ts-expect-error`
  - `@ts-nocheck`

Allows everything else (non-TS files, edits without escape hatches, malformed input).
"""

from __future__ import annotations

import json
import re
import sys

TS_EXT = re.compile(r"\.(ts|tsx|mts|cts)$", re.IGNORECASE)

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("`as any`",           re.compile(r"\bas\s+any\b")),
    ("`as unknown`",       re.compile(r"\bas\s+unknown\b")),
    ("`@ts-ignore`",       re.compile(r"@ts-ignore\b")),
    ("`@ts-expect-error`", re.compile(r"@ts-expect-error\b")),
    ("`@ts-nocheck`",      re.compile(r"@ts-nocheck\b")),
]


def added_content(payload: dict) -> tuple[str, str]:
    tool = payload.get("tool_name", "")
    inp = payload.get("tool_input") or {}
    path = inp.get("file_path", "") or ""
    parts: list[str] = []
    if tool == "Write":
        parts.append(inp.get("content", "") or "")
    elif tool == "Edit":
        parts.append(inp.get("new_string", "") or "")
    elif tool == "MultiEdit":
        for edit in inp.get("edits") or []:
            parts.append((edit or {}).get("new_string", "") or "")
    return path, "\n".join(parts)


def allow() -> None:
    sys.exit(0)


def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        allow()

    file_path, content = added_content(payload)

    if not file_path or not TS_EXT.search(file_path) or not content:
        allow()

    hits: list[tuple[str, int, str]] = []
    for label, rx in PATTERNS:
        for m in rx.finditer(content):
            line = content.count("\n", 0, m.start()) + 1
            hits.append((label, line, m.group(0)))

    if not hits:
        allow()

    bullets = "\n".join(
        f"  - {label} at line ~{ln}: `{snippet}`" for label, ln, snippet in hits
    )
    reason = (
        "Blocked: this change introduces a TypeScript escape hatch.\n\n"
        f"In {file_path}:\n{bullets}\n\n"
        "These bypasses hide real type errors instead of fixing them. "
        "Address the underlying issue:\n"
        "  - Narrow with a guard (`typeof`, `in`, custom predicate) instead of asserting.\n"
        "  - Fix the upstream type so the assertion isn't needed.\n"
        "  - Parse with Zod/the contract schema at trust boundaries instead of `as` casts.\n"
        "  - If the contract is wrong, fix it in `@raket/contracts` first.\n\n"
        "If this case is genuinely necessary, ask the user before proceeding."
    )
    deny(reason)


if __name__ == "__main__":
    main()
