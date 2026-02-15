# Planerix Server Runbook (canonical)

## Project
- Path: /opt/planerix
- Compose env: /opt/planerix/.env  (ONLY source for API env)
- apps/api/.env must NOT be used

## Containers & host ports
- planerix-api:        127.0.0.1:8000 -> 8000
- planerix-web:        127.0.0.1:3002 -> 3000
- planerix-landing:    127.0.0.1:3001 -> 3000
- planerix-n8n:        127.0.0.1:5678 -> 5678
- planerix-lightrag:   127.0.0.1:9621 -> 9621
- planerix-redis:      127.0.0.1:6379 -> 6379
- planerix-postgres:   127.0.0.1:5432 -> 5432
- itstep-postgres:     0.0.0.0:5433  -> 5432  (review: bind to 127.0.0.1 if external access not required)

## Runtime URLs (NO sslmode, NO query)
- LIDERIX_DB_URL=postgresql+asyncpg://USER:PASS@planerix-postgres:5432/liderixapp
- ITSTEP_DB_URL=postgresql+asyncpg://USER:PASS@itstep-postgres:5432/itstep_final
- REDIS_URL=redis://planerix-redis:6379/0

## Health
- Local:
  - http://127.0.0.1:8000/health
  - http://127.0.0.1:8000/api/health
- Public:
  - https://api.planerix.com/health
  - https://api.planerix.com/api/health

## Caddy
- Service: systemd caddy
- Config: /etc/caddy/Caddyfile
