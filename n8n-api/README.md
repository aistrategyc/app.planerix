Liderix API

FastAPI service powering Planerix web-enterprise.

Quick start (local):
- Create `.env` with required variables.
- `poetry install`
- `uvicorn liderix_api.main:app --host 0.0.0.0 --port 8000`

Notes:
- Alembic migrations live in `alembic/versions`.
- Health endpoints: `/health`, `/health/ready`, `/api/health`.
