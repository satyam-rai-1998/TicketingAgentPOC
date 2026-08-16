"""
WSGI entrypoint for PythonAnywhere.

PythonAnywhere's standard "Web" app hosting serves WSGI callables, but this
app is built on FastAPI/Starlette, which is ASGI. `a2wsgi.ASGIMiddleware`
adapts the ASGI app to a WSGI-compatible callable so it can be pointed to
from PythonAnywhere's WSGI configuration file. See ../README.md for the
step-by-step PythonAnywhere setup.
"""
import sys
from pathlib import Path

# PythonAnywhere imports this file's directory automatically, but keep this
# for safety when the file is loaded from an unexpected working directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from a2wsgi import ASGIMiddleware

from app.main import app as fastapi_app

application = ASGIMiddleware(fastapi_app)
