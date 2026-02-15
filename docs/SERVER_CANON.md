# Server Canon (Planerix)

## Compose root
- Path: /opt/planerix
- Canonical env for compose + API: /opt/planerix/.env
- apps/api/.env must NOT be used

## Containers (host bindings)
- API:      127.0.0.1:8000 -> 8000
- Web:      127.0.0.1:3002 -> 3000
- Landing:  127.0.0.1:3001 -> 3000
- N8N:      127.0.0.1:5678 -> 5678
- LightRAG: 127.0.0.1:9621 -> 9621
- Redis:    127.0.0.1:6379 -> 6379
- Postgres: 127.0.0.1:5432 -> 5432
- ITSTEP PG:0.0.0.0:5433  -> 5432  (consider binding to 127.0.0.1 if no external access needed)

## Health
- Local:  http://127.0.0.1:8000/health  and /api/health
- Public: https://api.planerix.com/health and /api/health

## Caddy
- Service: systemd caddy
- Config: /etc/caddy/Caddyfile
MDcd /opt/planerix
mkdir -p docs

cat > docs/SERVER_CANON.md <<'MD'
# Server Canon (Planerix)

## Compose root
- Path: /opt/planerix
- Canonical env for compose + API: /opt/planerix/.env
- apps/api/.env must NOT be used

## Containers (host bindings)
- API:      127.0.0.1:8000 -> 8000
- Web:      127.0.0.1:3002 -> 3000
- Landing:  127.0.0.1:3001 -> 3000
- N8N:      127.0.0.1:5678 -> 5678
- LightRAG: 127.0.0.1:9621 -> 9621
- Redis:    127.0.0.1:6379 -> 6379
- Postgres: 127.0.0.1:5432 -> 5432
- ITSTEP PG:0.0.0.0:5433  -> 5432  (consider binding to 127.0.0.1 if no external access needed)

## Health
- Local:  http://127.0.0.1:8000/health  and /api/health
- Public: https://api.planerix.com/health and /api/health

## Caddy
- Service: systemd caddy
- Config: /etc/caddy/Caddyfile
