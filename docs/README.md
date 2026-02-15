# Документация Planerix (канон)

Эта папка содержит актуальные серверные инструкции, а основной README — в корне репозитория.

## Быстрый старт

См. `../README.md`.

## Серверные документы

- `SERVER_CANON.md` — каноничные настройки сервера и инфраструктуры.
- `SERVER_RUNBOOK.md` — оперативные процедуры (старт/стоп, healthchecks, диагностика).

## Структура проекта

Основная структура теперь в `apps/`:
- `apps/web-enterprise/` — web‑enterprise (Next.js)
- `apps/api/` — FastAPI backend
- `apps/planerix/` — marketing/landing

Docker‑compose использует именно `apps/*`.

## Важно

- В репозиторий **не коммитятся** `.env` и секреты.
- Для локальной работы используйте `.env.example` в корне.

