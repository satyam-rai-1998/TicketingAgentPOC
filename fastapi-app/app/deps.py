from fastapi import Header, HTTPException, status

from .config import settings


def require_auth(authorization: str | None = Header(default=None)):
    scheme, _, token = (authorization or "").partition(" ")
    if scheme != "Bearer" or not token or token != settings.api_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "title": "Unauthorized",
                "message": "Missing or invalid Authorization: Bearer <token> header",
            },
        )
