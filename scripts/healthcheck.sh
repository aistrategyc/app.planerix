#!/usr/bin/env bash
set -euo pipefail
cd /opt/planerix

COMPOSE="docker compose -f /opt/planerix/docker-compose.yml -f /opt/planerix/docker-compose.promtail.override.yml"

echo "== COMPOSE PS =="
$COMPOSE ps

echo
echo "== HTTP HEALTH (host) =="
curl -sf http://127.0.0.1:8000/health >/dev/null && echo "API OK" || echo "API FAIL"
curl -sf http://127.0.0.1:3002 >/dev/null && echo "WEB OK" || echo "WEB FAIL"
curl -sf http://127.0.0.1:3001 >/dev/null && echo "LANDING OK" || echo "LANDING FAIL"
curl -sf http://127.0.0.1:3003/api/health >/dev/null && echo "GRAFANA OK" || echo "GRAFANA FAIL"
curl -sf http://127.0.0.1:9090/-/healthy >/dev/null && echo "PROMETHEUS OK" || echo "PROMETHEUS FAIL"
curl -sf http://127.0.0.1:3100/ready >/dev/null && echo "LOKI OK" || echo "LOKI FAIL"
curl -sf http://127.0.0.1:6333/healthz >/dev/null && echo "QDRANT OK" || echo "QDRANT FAIL"
curl -sf http://127.0.0.1:5678/healthz >/dev/null && echo "N8N OK" || echo "N8N (no /healthz or needs auth) [skip]"

# Promtail readiness: проверяем через отдельный curl-контейнер в network namespace promtail
docker run --rm --network container:planerix-promtail curlimages/curl:8.6.0 \
  -sf http://127.0.0.1:9080/ready >/dev/null && echo "PROMTAIL OK" || echo "PROMTAIL FAIL"

echo
echo "== POSTGRES: detect user/db from container env =="
for c in planerix-postgres itstep-postgres; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then
    U="$(docker exec -i "$c" sh -lc 'echo ${POSTGRES_USER:-postgres}' 2>/dev/null || echo postgres)"
    DB="$(docker exec -i "$c" sh -lc 'echo ${POSTGRES_DB:-postgres}' 2>/dev/null || echo postgres)"
    echo "-- $c  user=$U  db=$DB"
    docker exec -i "$c" psql -U "$U" -d "$DB" -c '\l' | head -n 30 || true
    docker exec -i "$c" psql -U "$U" -d "$DB" -c '\dn' | head -n 80 || true
  else
    echo "-- $c not running"
  fi
done

echo
echo "== LOKI end-to-end smoke =="
docker exec -i planerix-api sh -lc 'echo "LOKI_SMOKE_TEST api $(date -Is)" > /proc/1/fd/1'
sleep 2
NOW=$(date +%s); START=$((NOW-180))
curl -sG "http://127.0.0.1:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={service="api"} |= "LOKI_SMOKE_TEST"' \
  --data-urlencode "start=${START}000000000" \
  --data-urlencode "end=${NOW}000000000" \
  --data-urlencode 'limit=5' | head -c 1500; echo

echo "DONE"
