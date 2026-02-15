"""
Модели для аналитических данных из внешней базы ITSTEP
Витрины данных для отображения на страницах фронтенда
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base

# Базовый класс для аналитических моделей
AnalyticsBase = declarative_base()

class ClientAnalytics(AnalyticsBase):
    """Витрина аналитических данных по клиентам"""
    __tablename__ = "client_analytics"

    id = Column(Integer, primary_key=True)
    client_id = Column(String(255), nullable=False)
    client_name = Column(String(255), nullable=False)
    client_email = Column(String(255))
    registration_date = Column(DateTime)
    last_activity_date = Column(DateTime)
    total_orders = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    average_order_value = Column(Float, default=0.0)
    client_status = Column(String(50))  # active, inactive, blocked
    client_segment = Column(String(50))  # vip, regular, new
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

class OrganizationAnalytics(AnalyticsBase):
    """Витрина аналитических данных по организациям"""
    __tablename__ = "organization_analytics"

    id = Column(Integer, primary_key=True)
    org_id = Column(String(255), nullable=False)
    org_name = Column(String(255), nullable=False)
    org_type = Column(String(100))  # enterprise, small_business, startup
    industry = Column(String(100))
    registration_date = Column(DateTime)
    employees_count = Column(Integer, default=0)
    total_projects = Column(Integer, default=0)
    active_projects = Column(Integer, default=0)
    completed_projects = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    monthly_revenue = Column(Float, default=0.0)
    success_rate = Column(Float, default=0.0)
    client_satisfaction = Column(Float, default=0.0)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

class SalesAnalytics(AnalyticsBase):
    """Витрина данных по продажам"""
    __tablename__ = "sales_analytics"

    id = Column(Integer, primary_key=True)
    period_date = Column(DateTime, nullable=False)
    period_type = Column(String(20))  # daily, weekly, monthly, yearly
    total_sales = Column(Float, default=0.0)
    total_orders = Column(Integer, default=0)
    new_customers = Column(Integer, default=0)
    returning_customers = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    average_order_value = Column(Float, default=0.0)
    top_product_category = Column(String(100))
    sales_channel = Column(String(50))  # online, offline, mobile
    region = Column(String(100))
    created_at = Column(DateTime)

class MarketingAnalytics(AnalyticsBase):
    """Витрина данных по маркетингу"""
    __tablename__ = "marketing_analytics"

    id = Column(Integer, primary_key=True)
    campaign_id = Column(String(255))
    campaign_name = Column(String(255))
    campaign_type = Column(String(100))  # email, social, ppc, organic
    period_date = Column(DateTime, nullable=False)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    click_through_rate = Column(Float, default=0.0)
    conversions = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    cost_per_click = Column(Float, default=0.0)
    cost_per_acquisition = Column(Float, default=0.0)
    return_on_investment = Column(Float, default=0.0)
    budget_spent = Column(Float, default=0.0)
    created_at = Column(DateTime)

class FinancialAnalytics(AnalyticsBase):
    """Витрина финансовых данных"""
    __tablename__ = "financial_analytics"

    id = Column(Integer, primary_key=True)
    period_date = Column(DateTime, nullable=False)
    period_type = Column(String(20))  # daily, weekly, monthly, quarterly, yearly
    revenue = Column(Float, default=0.0)
    expenses = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)
    profit_margin = Column(Float, default=0.0)
    cash_flow = Column(Float, default=0.0)
    accounts_receivable = Column(Float, default=0.0)
    accounts_payable = Column(Float, default=0.0)
    recurring_revenue = Column(Float, default=0.0)
    one_time_revenue = Column(Float, default=0.0)
    created_at = Column(DateTime)

class ProjectAnalytics(AnalyticsBase):
    """Витрина данных по проектам"""
    __tablename__ = "project_analytics"

    id = Column(Integer, primary_key=True)
    project_id = Column(String(255), nullable=False)
    project_name = Column(String(255))
    project_status = Column(String(50))  # planning, active, completed, cancelled
    client_id = Column(String(255))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    planned_budget = Column(Float, default=0.0)
    actual_budget = Column(Float, default=0.0)
    budget_variance = Column(Float, default=0.0)
    planned_duration = Column(Integer)  # in days
    actual_duration = Column(Integer)  # in days
    completion_percentage = Column(Float, default=0.0)
    team_size = Column(Integer, default=0)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

class UserActivityAnalytics(AnalyticsBase):
    """Витрина данных по активности пользователей"""
    __tablename__ = "user_activity_analytics"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False)
    period_date = Column(DateTime, nullable=False)
    login_count = Column(Integer, default=0)
    session_duration = Column(Float, default=0.0)  # in minutes
    pages_visited = Column(Integer, default=0)
    actions_performed = Column(Integer, default=0)
    features_used = Column(Text)  # JSON list of features
    last_login = Column(DateTime)
    device_type = Column(String(50))  # desktop, mobile, tablet
    browser = Column(String(100))
    created_at = Column(DateTime)

class BusinessKPIAnalytics(AnalyticsBase):
    """Витрина ключевых показателей эффективности"""
    __tablename__ = "business_kpi_analytics"

    id = Column(Integer, primary_key=True)
    period_date = Column(DateTime, nullable=False)
    kpi_name = Column(String(255), nullable=False)
    kpi_category = Column(String(100))  # financial, operational, customer, growth
    current_value = Column(Float, default=0.0)
    target_value = Column(Float, default=0.0)
    previous_value = Column(Float, default=0.0)
    percentage_change = Column(Float, default=0.0)
    trend = Column(String(20))  # up, down, stable
    is_target_met = Column(Boolean, default=False)
    unit = Column(String(50))  # %, $, count, etc.
    created_at = Column(DateTime)