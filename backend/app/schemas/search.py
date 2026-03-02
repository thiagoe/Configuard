"""
Search schemas (Pydantic models)
"""

from datetime import datetime
from typing import List

from pydantic import BaseModel


class SearchSnippet(BaseModel):
    line: int
    content: str


class SearchResult(BaseModel):
    configuration_id: str
    device_id: str
    device_name: str
    version: int
    collected_at: datetime
    matches: int
    snippets: List[SearchSnippet]


class SearchResponse(BaseModel):
    items: List[SearchResult]
    total: int
    page: int
    page_size: int
    total_pages: int
