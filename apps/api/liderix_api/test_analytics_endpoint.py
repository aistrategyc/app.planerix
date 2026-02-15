# Простой тестовый endpoint для аналитики ITstep без аутентификации
from fastapi import APIRouter, HTTPException
import asyncpg
import os
from typing import Dict, Any
import json
import logging

router = APIRouter(prefix="/test-analytics", tags=["Test Analytics"])

logger = logging.getLogger(__name__)

ITSTEP_DB_URL = os.getenv("ITSTEP_DB_URL", "postgresql+asyncpg://bi_app:Resurgam65!@92.242.60.211:5432/itstep_final")

async def get_itstep_connection():
    """Get connection to ITstep database"""
    try:
        # Конвертируем URL для asyncpg (без +asyncpg)
        db_url = ITSTEP_DB_URL.replace("postgresql+asyncpg://", "postgresql://")
        return await asyncpg.connect(db_url)
    except Exception as e:
        logger.error(f"Failed to connect to ITstep DB: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

@router.get("/connection-test")
async def test_connection():
    """Test connection to ITstep database"""
    try:
        conn = await get_itstep_connection()
        result = await conn.fetchrow("SELECT version()")
        await conn.close()

        return {
            "status": "success",
            "message": "Connection to ITstep database successful",
            "db_version": result['version'] if result else "Unknown"
        }
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return {
            "status": "error",
            "message": f"Connection failed: {str(e)}"
        }

@router.get("/tables")
async def list_tables():
    """List tables in ITstep database from dm and dwh schemas"""
    try:
        conn = await get_itstep_connection()

        query = """
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('dm', 'dwh', 'public', 'dashboards')
        ORDER BY table_schema, table_name
        LIMIT 50
        """

        tables = await conn.fetch(query)
        await conn.close()

        return {
            "status": "success",
            "tables": [{"schema": table['table_schema'], "name": table['table_name']} for table in tables]
        }
    except Exception as e:
        logger.error(f"Failed to list tables: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list tables: {str(e)}")

@router.get("/test-permissions")
async def test_permissions():
    """Test database permissions for different schemas"""
    try:
        conn = await get_itstep_connection()
        results = {}

        # Test access to different schemas
        schemas_to_test = ['public', 'dm', 'dwh', 'dashboards']

        for schema in schemas_to_test:
            try:
                query = f"SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = '{schema}'"
                result = await conn.fetchrow(query)
                results[schema] = {"accessible": True, "table_count": result['table_count']}
            except Exception as e:
                results[schema] = {"accessible": False, "error": str(e)}

        # Also test actual table access
        test_queries = {}

        # Test dm schema access
        try:
            query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'dm' LIMIT 5"
            dm_tables = await conn.fetch(query)
            test_queries['dm_tables'] = [row['table_name'] for row in dm_tables]
        except Exception as e:
            test_queries['dm_tables'] = {"error": str(e)}

        # Test dwh schema access
        try:
            query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'dwh' LIMIT 5"
            dwh_tables = await conn.fetch(query)
            test_queries['dwh_tables'] = [row['table_name'] for row in dwh_tables]
        except Exception as e:
            test_queries['dwh_tables'] = {"error": str(e)}

        await conn.close()

        return {
            "status": "success",
            "schema_access": results,
            "table_samples": test_queries
        }
    except Exception as e:
        logger.error(f"Failed to test permissions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test permissions: {str(e)}")

@router.get("/real-contracts")
async def get_real_contract_data():
    """Get real contract data from ITstep dwh schema"""
    try:
        conn = await get_itstep_connection()

        # Test real contract data
        contracts_query = """
        SELECT
            fc.contract_date::date,
            COUNT(*) as contract_count,
            SUM(fc.contract_sum) as total_revenue,
            SUM(fc.first_payment_sum) as total_first_payment
        FROM dwh.fact_contracts fc
        WHERE fc.contract_date >= CURRENT_DATE - INTERVAL '7 days'
          AND fc.contract_sum > 0
        GROUP BY fc.contract_date::date
        ORDER BY fc.contract_date::date DESC
        LIMIT 7
        """

        contracts = await conn.fetch(contracts_query)
        contract_data = [dict(row) for row in contracts]

        # Test branch data
        branch_query = """
        SELECT
            db.branch_name,
            COUNT(fc.contract_id) as contract_count,
            SUM(fc.contract_sum) as total_revenue
        FROM dwh.fact_contracts fc
        JOIN dwh.dim_branch db ON fc.branch_key = db.branch_key
        WHERE fc.contract_date >= CURRENT_DATE - INTERVAL '30 days'
          AND fc.contract_sum > 0
        GROUP BY db.branch_name
        ORDER BY total_revenue DESC
        LIMIT 5
        """

        branches = await conn.fetch(branch_query)
        branch_data = [dict(row) for row in branches]

        await conn.close()

        return {
            "status": "success",
            "message": "Real ITstep contract data loaded successfully!",
            "data": {
                "daily_contracts": contract_data,
                "branch_performance": branch_data,
                "data_source": "dwh.fact_contracts & dwh.dim_branch"
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error accessing real contract data: {str(e)}"
        }

@router.get("/sample-data")
async def get_sample_analytics_data():
    """Get sample analytics data from ITstep database"""
    try:
        conn = await get_itstep_connection()

        # Пробуем получить данные из возможных аналитических таблиц
        sample_queries = [
            ("users_count", "SELECT COUNT(*) as count FROM users"),
            ("recent_activity", "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 5"),
            ("table_info", "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' LIMIT 10")
        ]

        results = {}

        for query_name, query in sample_queries:
            try:
                data = await conn.fetch(query)
                results[query_name] = {
                    "status": "success",
                    "data": [dict(row) for row in data] if data else []
                }
            except Exception as e:
                results[query_name] = {
                    "status": "error",
                    "error": str(e)
                }

        await conn.close()

        return {
            "status": "success",
            "database": "ITstep Analytics",
            "timestamp": "2025-09-29",
            "queries": results
        }

    except Exception as e:
        logger.error(f"Failed to get sample data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get sample data: {str(e)}")

@router.get("/health")
async def analytics_health():
    """Health check for analytics system"""
    return {
        "status": "healthy",
        "service": "ITstep Analytics Test",
        "database_configured": bool(ITSTEP_DB_URL),
        "timestamp": "2025-09-29"
    }