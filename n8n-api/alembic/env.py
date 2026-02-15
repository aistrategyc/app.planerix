from __future__ import annotations

import os
import sys
import importlib
import pkgutil
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection

# --- Подготовка sys.path, чтобы импортировать приложение ---
HERE = os.path.abspath(os.path.dirname(__file__))
APPS_API_DIR = os.path.abspath(os.path.join(HERE, ".."))
if APPS_API_DIR not in sys.path:
    sys.path.append(APPS_API_DIR)

# --- Alembic config & logging ---
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- Импорт настроек и моделей ---
from liderix_api.config.settings import settings

# Безопасный импорт Base
try:
    from liderix_api.models.base import Base
except ImportError:
    from liderix_api.db import Base

# --- Импорт всех подмодулей в models ---
import liderix_api.models as models_pkg
for finder, name, ispkg in pkgutil.walk_packages(models_pkg.__path__, models_pkg.__name__ + "."):
    try:
        importlib.import_module(name)
    except ImportError as e:
        print(f"Warning: Could not import {name}: {e}")

target_metadata = Base.metadata

# --- DB URL ---
def get_database_url() -> str:
    """
    Returns the database URL for Alembic migrations from settings.
    """
    # Получаем URL из настроек приложения
    db_url = settings.LIDERIX_DB_URL
    # Конвертируем asyncpg URL в синхронный для alembic
    if db_url and "postgresql+asyncpg://" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    return db_url

# --- Схема для хранения alembic_version ---
def get_version_table_schema():
    """Возвращает схему для таблицы alembic_version"""
    schema = os.getenv("ALEMBIC_VERSION_SCHEMA", "public")
    return schema if schema else None

# --- Автогенерация: фильтрация объектов ---
def include_object(object, name, type_, reflected, compare_to):
    """Фильтрация объектов для автогенерации миграций"""
    return True

# --- Offline миграции (только SQL скрипт) ---
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=False,
        version_table="alembic_version",
        version_table_schema=get_version_table_schema(),
    )

    with context.begin_transaction():
        context.run_migrations()

# --- Online миграции (с реальным подключением к БД) ---
def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(
        get_database_url(),
        poolclass=pool.NullPool,
        future=True,
        echo=False,  # Отключаем логирование SQL запросов
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=False,
            version_table="alembic_version",
            version_table_schema=get_version_table_schema(),
        )

        with context.begin_transaction():
            context.run_migrations()

# --- Entrypoint ---
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()