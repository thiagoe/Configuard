"""
Search API routes - search within configurations using PostgreSQL Full-Text Search.

Uses to_tsvector('simple', config_data) @@ plainto_tsquery('simple', term) backed
by a GIN index for fast searches on large configuration datasets.
The 'simple' dictionary is intentional: no stemming preserves network tokens
(IP addresses, interface names, vendor commands, etc.) exactly as typed.

Note: terms containing dots (e.g. partial IPs like "192.168") fall back to ILIKE
because to_tsvector tokenizes "192.168.0.1" as a single token that won't match
a partial "192.168" query. ILIKE handles prefix/partial matching for such cases.

Additional modes:
- latest_only: restrict search to the most recent version per device
- regex_mode: use PostgreSQL ~* operator (case-insensitive regex) instead of FTS/ILIKE
"""

import re
from datetime import timedelta
from math import ceil
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, status
from sqlalchemy import func, literal

from app.core.deps import CurrentUser, DbSession, user_id_filter
from app.core.timezone import now
from app.models.configuration import Configuration
from app.models.device import Device
from app.schemas.search import SearchResponse, SearchResult, SearchSnippet

router = APIRouter()

# Matches partial IP octets, CIDR prefixes, or hex colons (e.g. "192.168", "10.0", "fe80:")
# These are tokenized as whole units by to_tsvector so partial FTS won't match them
_PARTIAL_TOKEN_RE = re.compile(r'[0-9]+\.[0-9]|/[0-9]|[0-9a-fA-F]+:[0-9a-fA-F]')


def _is_partial_token(term: str) -> bool:
    """Return True when the term looks like a partial IP, CIDR, or IPv6 prefix."""
    return bool(_PARTIAL_TOKEN_RE.search(term))


@router.get("", response_model=SearchResponse)
async def search_configurations(
    current_user: CurrentUser,
    db: DbSession,
    q: str = Query(..., min_length=2, max_length=500, description="Search term"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    device_ids: Optional[str] = Query(None, description="Filter by device IDs (comma-separated)"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    days: Optional[int] = Query(None, ge=1, le=36500, description="Filter by last N days"),
    latest_only: bool = Query(False, description="Return only the latest version per device"),
    regex_mode: bool = Query(False, description="Use regex matching instead of full-text search"),
):
    """
    Full-text search within configuration data.
    Uses PostgreSQL tsvector/tsquery with GIN index for fast, ranked results.
    Falls back to ILIKE for partial IP/CIDR patterns.
    Supports regex_mode (PostgreSQL ~* operator) and latest_only filtering.
    """
    term = q.strip()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search term is required",
        )

    # Validate regex if regex_mode — compile once and reuse later
    compiled_regex: re.Pattern | None = None
    if regex_mode:
        try:
            compiled_regex = re.compile(term, re.IGNORECASE)
        except re.error as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid regex pattern: {e}",
            )

    ts_vector = func.to_tsvector("simple", Configuration.config_data)

    if regex_mode:
        rank_col = literal(0.0).label("rank")
        query = (
            db.query(Configuration, Device, rank_col)
            .join(Device, Configuration.device_id == Device.id)
            .filter(Configuration.config_data.op("~*")(term))
        )
    elif _is_partial_token(term):
        rank_col = literal(0.0).label("rank")
        query = (
            db.query(Configuration, Device, rank_col)
            .join(Device, Configuration.device_id == Device.id)
            .filter(Configuration.config_data.ilike(f"%{term}%"))
        )
    else:
        ts_query = func.plainto_tsquery("simple", term)
        rank_col = func.ts_rank(ts_vector, ts_query).label("rank")
        query = (
            db.query(Configuration, Device, rank_col)
            .join(Device, Configuration.device_id == Device.id)
            .filter(ts_vector.op("@@")(ts_query))
        )

    f = user_id_filter(Device, current_user)
    if f is not None:
        query = query.filter(f)

    # Filter by devices (multiple)
    if device_ids:
        device_id_list = [d.strip() for d in device_ids.split(",") if d.strip()]
        if device_id_list:
            query = query.filter(Device.id.in_(device_id_list))

    # Filter by category
    if category_id:
        query = query.filter(Device.category_id == category_id)

    # Filter by date range
    if days:
        date_from = now() - timedelta(days=days)
        query = query.filter(Configuration.collected_at >= date_from)

    # Filter to latest version per device.
    # DISTINCT ON (device_id) ORDER BY device_id, version DESC is faster than
    # a GROUP BY MAX subquery because it uses the existing (device_id, version) index.
    if latest_only:
        latest_subq = (
            db.query(Configuration.id)
            .distinct(Configuration.device_id)
            .order_by(Configuration.device_id, Configuration.version.desc())
            .subquery()
        )
        query = query.filter(Configuration.id.in_(latest_subq))

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    rows = (
        query.order_by(
            rank_col.desc(),
            Configuration.collected_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items: list[SearchResult] = []

    for config, device, _rank in rows:
        config_text = config.config_data or ""

        if regex_mode:
            # compiled_regex was validated and compiled above — reuse it here
            assert compiled_regex is not None
            matching_lines = [
                (idx, line)
                for idx, line in enumerate(config_text.splitlines(), start=1)
                if compiled_regex.search(line)
            ]
            matches = len(matching_lines)
            snippets = [
                SearchSnippet(line=idx, content=line)
                for idx, line in matching_lines[:3]
            ]
        else:
            term_lower = term.lower()
            matches = config_text.lower().count(term_lower)
            snippets = []
            for idx, line in enumerate(config_text.splitlines(), start=1):
                if term_lower in line.lower():
                    snippets.append(SearchSnippet(line=idx, content=line))
                if len(snippets) >= 3:
                    break

        items.append(
            SearchResult(
                configuration_id=config.id,
                device_id=device.id,
                device_name=device.name,
                version=config.version,
                collected_at=config.collected_at,
                matches=matches,
                snippets=snippets,
            )
        )

    return SearchResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
