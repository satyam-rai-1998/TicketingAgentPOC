from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .database import init_db
from .routers import tickets, widget

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"

app = FastAPI(title="Zendesk POC ticketing app")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/v2/health")
def health():
    return {"ok": True}


# Lets the unauthenticated dashboard pick up the API token for its own
# fetch() calls. Fine for a local POC; would need a real session/auth model
# before this ever left localhost.
@app.get("/dashboard-config.json")
def dashboard_config():
    return {"api_token": settings.api_token}


app.include_router(widget.router)
app.include_router(tickets.router)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "title" in detail:
        body = {"error": detail}
    else:
        body = {"error": {"title": "Error", "message": str(detail)}}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p not in ("body",))
    message = first.get("msg", "Invalid request")
    return JSONResponse(
        status_code=400,
        content={"error": {"title": "InvalidRecord", "message": f"{field}: {message}" if field else message}},
    )


# Dashboard + public support site (static, unauthenticated — POC only, no
# login system). Mounted last so the API routes above take precedence.
app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")
