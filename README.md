# Planerix

Платформа продуктовой и маркетинговой аналитики с тремя слоями:
- **Core**: организации, пользователи, проекты, задачи, OKR, календарь.
- **Analytics**: витрины raw/stg/dwh/sem для виджетов и отчетов.
- **AI**: инсайты, рекомендации, автоматизация (n8n + AI workflows).

## Репозиторий

Основные директории:
- `apps/web-enterprise/` — web‑enterprise (Next.js App Router)
- `apps/api/` — FastAPI backend
- `apps/planerix/` — marketing/landing
- `infra/` — observability (Prometheus/Grafana/Loki/Promtail)
- `scripts/` — сервисные скрипты
- `docs/` — серверные инструкции и runbook

## Быстрый старт (локально)

1. Подготовить окружение:
   - Скопируйте `.env.example` → `.env` и заполните значения.
2. Запуск:

```bash
# в корне репозитория
sudo docker compose up -d --build web api
```

3. Проверка готовности API:

```bash
curl -sS http://localhost:8000/health/ready | jq .
```

4. Основные порты:
- Web: `http://localhost:3002`
- API: `http://localhost:8000`
- Landing: `http://localhost:3001`
- n8n: `http://localhost:5678`
- Grafana: `http://localhost:3003`

## Переменные окружения

- Конфиг хранится в `.env` (не коммитится).
- Шаблон переменных: `.env.example`.

## Документация

Серверные инструкции находятся в `docs/`:
- `docs/SERVER_CANON.md`
- `docs/SERVER_RUNBOOK.md`

## Примечания

- Никогда не коммитить реальные ключи и секреты.
- Для прод‑среды используйте отдельные секреты и переменные.

