import time
from collections import defaultdict

from fastapi import Request, HTTPException, status

# Minimal in-memory per-IP rate limiter for the unauthenticated public widget
# endpoint. Good enough for a POC; does not survive a restart and does not
# work across multiple worker processes.
_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(window_seconds: int = 60, max_requests: int = 5):
    def _check(request: Request):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        recent = [ts for ts in _hits[ip] if now - ts < window_seconds]

        if len(recent) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "title": "TooManyRequests",
                    "message": "Please wait a moment before submitting again.",
                },
            )

        recent.append(now)
        _hits[ip] = recent

    return _check
