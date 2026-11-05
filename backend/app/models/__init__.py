"""ORM models.

Importing this package registers every model on ``Base.metadata``, which is what Alembic uses to
diff the schema. Add new modules to ``__all__`` and import them here.
"""

from app.models.user import User

__all__ = ["User"]
