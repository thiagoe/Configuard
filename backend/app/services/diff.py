"""
Configuration diff utilities
"""

from difflib import unified_diff
from typing import Tuple


def generate_unified_diff(
    from_text: str,
    to_text: str,
    from_label: str = "from",
    to_label: str = "to",
    context_lines: int = 3,
) -> Tuple[str, int, int]:
    """
    Generate unified diff and line stats.
    """
    from_lines = from_text.splitlines(keepends=True)
    to_lines = to_text.splitlines(keepends=True)

    diff_lines = list(
        unified_diff(
            from_lines,
            to_lines,
            fromfile=from_label,
            tofile=to_label,
            n=context_lines,
        )
    )

    added = 0
    removed = 0
    for line in diff_lines:
        if line.startswith("+++ ") or line.startswith("--- ") or line.startswith("@@"):
            continue
        if line.startswith("+"):
            added += 1
        elif line.startswith("-"):
            removed += 1

    diff_text = "".join(diff_lines).strip()
    return diff_text, added, removed
