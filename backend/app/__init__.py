"""Nexa AI backend application package.

The ASGI application is exposed as ``app.main:app``. Importing this package stays side-effect
free so that tooling (Alembic, tests, scripts) can import submodules without booting the app.
"""
