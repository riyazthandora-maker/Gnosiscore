"""
Converts raw extracted page text into clean, token-efficient Markdown.

Goals:
- Strip page numbers, repeated headers/footers, and decorative separators
- Promote ALL-CAPS short lines to H2 headings (common in textbooks)
- Collapse excessive blank lines
- Estimate token count (~4 chars per token)
"""
import re
from collections import Counter


# ── Regex patterns ────────────────────────────────────────────────────────────

_PAGE_NUMBER = re.compile(
    r"^\s*[-–—]?\s*\d{1,4}\s*[-–—]?\s*$"          # - 12 - or just 12
    r"|^\s*page\s+\d+(\s+of\s+\d+)?\s*$",           # Page 12 of 50
    re.IGNORECASE | re.MULTILINE,
)
_SEPARATOR = re.compile(r"^[\s*\-_=~]{3,}\s*$", re.MULTILINE)
_MULTI_BLANK = re.compile(r"\n{3,}")
_LEADING_TRAILING_SPACE = re.compile(r"[ \t]+$", re.MULTILINE)

# A heading candidate: short line (≤ 80 chars), ALL CAPS or Title Case, no sentence end
_HEADING_CANDIDATE = re.compile(
    r"^(?=[A-Z][^a-z]{0,79}$)(?!.*[.!?]\s*$).{3,80}$",
    re.MULTILINE,
)


def _detect_repeated_lines(pages: list[str], min_freq: int = 3) -> set[str]:
    """Find lines that appear verbatim across ≥ min_freq pages — likely headers/footers."""
    counter: Counter[str] = Counter()
    for page in pages:
        seen_on_page: set[str] = set()
        for line in page.splitlines():
            stripped = line.strip()
            if stripped and stripped not in seen_on_page:
                counter[stripped] += 1
                seen_on_page.add(stripped)
    return {line for line, count in counter.items() if count >= min_freq}


def _clean_page(text: str, repeated: set[str]) -> str:
    lines = text.splitlines()
    cleaned: list[str] = []
    for line in lines:
        stripped = line.strip()
        # Drop repeated boilerplate (headers/footers)
        if stripped in repeated:
            continue
        # Drop page numbers and separators
        if _PAGE_NUMBER.match(stripped) or _SEPARATOR.match(stripped):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def _promote_headings(text: str) -> str:
    def replace(m: re.Match) -> str:
        line = m.group(0).strip()
        # Short ALL-CAPS → H2, Title Case → H3
        if line.isupper():
            return f"\n## {line.title()}"
        return f"\n### {line}"
    return _HEADING_CANDIDATE.sub(replace, text)


def pages_to_markdown(pages: list[str], title: str = "") -> tuple[str, int]:
    """
    Convert raw page strings to a single clean Markdown string.
    Returns (markdown, estimated_token_count).
    """
    repeated = _detect_repeated_lines(pages)
    parts: list[str] = []

    if title:
        parts.append(f"# {title}\n")

    for i, page in enumerate(pages, 1):
        cleaned = _clean_page(page, repeated)
        if not cleaned.strip():
            continue
        # Separate pages with a soft divider (two blank lines — not a token-hungry HR)
        if parts:
            parts.append("")
        parts.append(cleaned)

    markdown = "\n".join(parts)
    markdown = _leading_trailing_space_strip(markdown)
    markdown = _MULTI_BLANK.sub("\n\n", markdown)
    markdown = _promote_headings(markdown)
    markdown = markdown.strip()

    token_count = max(1, len(markdown) // 4)
    return markdown, token_count


def _leading_trailing_space_strip(text: str) -> str:
    return _LEADING_TRAILING_SPACE.sub("", text)


def single_text_to_markdown(raw: str, title: str = "") -> tuple[str, int]:
    """Convenience wrapper for single-page sources (images)."""
    return pages_to_markdown([raw], title=title)
