"""
Request logging middleware
"""

import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_api_logger, set_request_id, get_request_id

api_logger = get_api_logger()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging all API requests and responses"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]
        set_request_id(request_id)

        # Store request ID in request state for access in routes
        request.state.request_id = request_id

        # Start timing
        start_time = time.time()

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        # Log request
        api_logger.info(
            f"Request started",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            query=str(request.query_params) if request.query_params else None,
            client_ip=client_ip,
            user_agent=request.headers.get("User-Agent"),
        )

        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            # Log exception
            process_time = time.time() - start_time
            api_logger.error(
                f"Request failed with exception",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                error=str(e),
                duration_ms=round(process_time * 1000, 2),
            )
            raise

        # Calculate processing time
        process_time = time.time() - start_time

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        # Log response
        api_logger.info(
            f"Request completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(process_time * 1000, 2),
        )

        return response
