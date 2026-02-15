--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Debian 14.18-1.pgdg120+1)
-- Dumped by pg_dump version 14.18 (Debian 14.18-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ai; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ai;


--
-- Name: registry; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA registry;


--
-- Name: usage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA usage;


--
-- Name: ai_action_status; Type: TYPE; Schema: ai; Owner: -
--

CREATE TYPE ai.ai_action_status AS ENUM (
    'proposed',
    'approved',
    'executing',
    'done',
    'failed',
    'cancelled'
);


--
-- Name: ai_outbox_status; Type: TYPE; Schema: ai; Owner: -
--

CREATE TYPE ai.ai_outbox_status AS ENUM (
    'pending',
    'processing',
    'sent',
    'failed',
    'dead'
);


--
-- Name: ai_run_status; Type: TYPE; Schema: ai; Owner: -
--

CREATE TYPE ai.ai_run_status AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actions; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.actions (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    run_id bigint,
    insight_id bigint,
    action_type text NOT NULL,
    status ai.ai_action_status DEFAULT 'proposed'::ai.ai_action_status NOT NULL,
    title text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    due_at timestamp with time zone,
    executed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: actions_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.actions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actions_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.actions_id_seq OWNED BY ai.actions.id;


--
-- Name: agent_registry; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.agent_registry (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    agent_name text NOT NULL,
    agent_version text DEFAULT 'v1'::text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    schedule text,
    default_inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    policies jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_registry_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.agent_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.agent_registry_id_seq OWNED BY ai.agent_registry.id;


--
-- Name: evaluations; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.evaluations (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    run_id bigint,
    prompt_version_id bigint,
    eval_type text DEFAULT 'human'::text NOT NULL,
    score numeric,
    rubric jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evaluations_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.evaluations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.evaluations_id_seq OWNED BY ai.evaluations.id;


--
-- Name: impact; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.impact (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    action_id bigint,
    metric_key text NOT NULL,
    baseline_value numeric,
    measured_value numeric,
    delta_value numeric,
    measured_at timestamp with time zone DEFAULT now() NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: impact_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.impact_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: impact_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.impact_id_seq OWNED BY ai.impact.id;


--
-- Name: insights; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.insights (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    run_id bigint,
    insight_type text NOT NULL,
    severity smallint,
    title text NOT NULL,
    summary text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    entity_type text,
    entity_id text,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insights_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.insights_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insights_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.insights_id_seq OWNED BY ai.insights.id;


--
-- Name: memory_refs; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.memory_refs (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    memory_type text NOT NULL,
    scope text,
    entity_type text,
    entity_id text,
    qdrant_collection text NOT NULL,
    qdrant_point_id text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: memory_refs_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.memory_refs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: memory_refs_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.memory_refs_id_seq OWNED BY ai.memory_refs.id;


--
-- Name: outbox; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.outbox (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    event_type text NOT NULL,
    status ai.ai_outbox_status DEFAULT 'pending'::ai.ai_outbox_status NOT NULL,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: outbox_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.outbox_id_seq OWNED BY ai.outbox.id;


--
-- Name: prompt_versions; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.prompt_versions (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    prompt_key text NOT NULL,
    version text NOT NULL,
    content text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prompt_versions_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.prompt_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prompt_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.prompt_versions_id_seq OWNED BY ai.prompt_versions.id;


--
-- Name: runs; Type: TABLE; Schema: ai; Owner: -
--

CREATE TABLE ai.runs (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    agent_name text NOT NULL,
    agent_version text DEFAULT 'v1'::text NOT NULL,
    status ai.ai_run_status DEFAULT 'queued'::ai.ai_run_status NOT NULL,
    trigger text,
    request_id text,
    trace_id text,
    model text,
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    output jsonb DEFAULT '{}'::jsonb NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: runs_id_seq; Type: SEQUENCE; Schema: ai; Owner: -
--

CREATE SEQUENCE ai.runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: runs_id_seq; Type: SEQUENCE OWNED BY; Schema: ai; Owner: -
--

ALTER SEQUENCE ai.runs_id_seq OWNED BY ai.runs.id;


--
-- Name: entity_links; Type: TABLE; Schema: registry; Owner: -
--

CREATE TABLE registry.entity_links (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    left_type text NOT NULL,
    left_id text NOT NULL,
    rel_type text NOT NULL,
    right_type text NOT NULL,
    right_id text NOT NULL,
    weight numeric,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entity_links_id_seq; Type: SEQUENCE; Schema: registry; Owner: -
--

CREATE SEQUENCE registry.entity_links_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entity_links_id_seq; Type: SEQUENCE OWNED BY; Schema: registry; Owner: -
--

ALTER SEQUENCE registry.entity_links_id_seq OWNED BY registry.entity_links.id;


--
-- Name: events; Type: TABLE; Schema: usage; Owner: -
--

CREATE TABLE usage.events (
    id bigint NOT NULL,
    tenant_key text NOT NULL,
    actor_type text,
    actor_id text,
    event_type text NOT NULL,
    provider text,
    model text,
    units numeric,
    unit_type text,
    cost_usd numeric,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: usage; Owner: -
--

CREATE SEQUENCE usage.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: usage; Owner: -
--

ALTER SEQUENCE usage.events_id_seq OWNED BY usage.events.id;


--
-- Name: actions id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.actions ALTER COLUMN id SET DEFAULT nextval('ai.actions_id_seq'::regclass);


--
-- Name: agent_registry id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.agent_registry ALTER COLUMN id SET DEFAULT nextval('ai.agent_registry_id_seq'::regclass);


--
-- Name: evaluations id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.evaluations ALTER COLUMN id SET DEFAULT nextval('ai.evaluations_id_seq'::regclass);


--
-- Name: impact id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.impact ALTER COLUMN id SET DEFAULT nextval('ai.impact_id_seq'::regclass);


--
-- Name: insights id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.insights ALTER COLUMN id SET DEFAULT nextval('ai.insights_id_seq'::regclass);


--
-- Name: memory_refs id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.memory_refs ALTER COLUMN id SET DEFAULT nextval('ai.memory_refs_id_seq'::regclass);


--
-- Name: outbox id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.outbox ALTER COLUMN id SET DEFAULT nextval('ai.outbox_id_seq'::regclass);


--
-- Name: prompt_versions id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.prompt_versions ALTER COLUMN id SET DEFAULT nextval('ai.prompt_versions_id_seq'::regclass);


--
-- Name: runs id; Type: DEFAULT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.runs ALTER COLUMN id SET DEFAULT nextval('ai.runs_id_seq'::regclass);


--
-- Name: entity_links id; Type: DEFAULT; Schema: registry; Owner: -
--

ALTER TABLE ONLY registry.entity_links ALTER COLUMN id SET DEFAULT nextval('registry.entity_links_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: usage; Owner: -
--

ALTER TABLE ONLY usage.events ALTER COLUMN id SET DEFAULT nextval('usage.events_id_seq'::regclass);


--
-- Name: actions actions_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.actions
    ADD CONSTRAINT actions_pkey PRIMARY KEY (id);


--
-- Name: agent_registry agent_registry_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.agent_registry
    ADD CONSTRAINT agent_registry_pkey PRIMARY KEY (id);


--
-- Name: agent_registry agent_registry_tenant_key_agent_name_agent_version_key; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.agent_registry
    ADD CONSTRAINT agent_registry_tenant_key_agent_name_agent_version_key UNIQUE (tenant_key, agent_name, agent_version);


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.evaluations
    ADD CONSTRAINT evaluations_pkey PRIMARY KEY (id);


--
-- Name: impact impact_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.impact
    ADD CONSTRAINT impact_pkey PRIMARY KEY (id);


--
-- Name: insights insights_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.insights
    ADD CONSTRAINT insights_pkey PRIMARY KEY (id);


--
-- Name: memory_refs memory_refs_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.memory_refs
    ADD CONSTRAINT memory_refs_pkey PRIMARY KEY (id);


--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.outbox
    ADD CONSTRAINT outbox_pkey PRIMARY KEY (id);


--
-- Name: prompt_versions prompt_versions_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.prompt_versions
    ADD CONSTRAINT prompt_versions_pkey PRIMARY KEY (id);


--
-- Name: prompt_versions prompt_versions_tenant_key_prompt_key_version_key; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.prompt_versions
    ADD CONSTRAINT prompt_versions_tenant_key_prompt_key_version_key UNIQUE (tenant_key, prompt_key, version);


--
-- Name: runs runs_pkey; Type: CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (id);


--
-- Name: entity_links entity_links_pkey; Type: CONSTRAINT; Schema: registry; Owner: -
--

ALTER TABLE ONLY registry.entity_links
    ADD CONSTRAINT entity_links_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: usage; Owner: -
--

ALTER TABLE ONLY usage.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: ix_actions_payload_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_actions_payload_gin ON ai.actions USING gin (payload);


--
-- Name: ix_actions_tenant_status_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_actions_tenant_status_created ON ai.actions USING btree (tenant_key, status, created_at DESC);


--
-- Name: ix_actions_tenant_type_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_actions_tenant_type_created ON ai.actions USING btree (tenant_key, action_type, created_at DESC);


--
-- Name: ix_agent_registry_tenant_agent; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_agent_registry_tenant_agent ON ai.agent_registry USING btree (tenant_key, agent_name);


--
-- Name: ix_evals_rubric_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_evals_rubric_gin ON ai.evaluations USING gin (rubric);


--
-- Name: ix_evals_tenant_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_evals_tenant_created ON ai.evaluations USING btree (tenant_key, created_at DESC);


--
-- Name: ix_impact_meta_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_impact_meta_gin ON ai.impact USING gin (meta);


--
-- Name: ix_impact_tenant_metric_measured; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_impact_tenant_metric_measured ON ai.impact USING btree (tenant_key, metric_key, measured_at DESC);


--
-- Name: ix_insights_details_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_insights_details_gin ON ai.insights USING gin (details);


--
-- Name: ix_insights_entity; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_insights_entity ON ai.insights USING btree (tenant_key, entity_type, entity_id);


--
-- Name: ix_insights_evidence_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_insights_evidence_gin ON ai.insights USING gin (evidence);


--
-- Name: ix_insights_tenant_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_insights_tenant_created ON ai.insights USING btree (tenant_key, created_at DESC);


--
-- Name: ix_insights_tenant_type_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_insights_tenant_type_created ON ai.insights USING btree (tenant_key, insight_type, created_at DESC);


--
-- Name: ix_memory_refs_entity; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_memory_refs_entity ON ai.memory_refs USING btree (tenant_key, entity_type, entity_id);


--
-- Name: ix_memory_refs_meta_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_memory_refs_meta_gin ON ai.memory_refs USING gin (meta);


--
-- Name: ix_memory_refs_tenant_type_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_memory_refs_tenant_type_created ON ai.memory_refs USING btree (tenant_key, memory_type, created_at DESC);


--
-- Name: ix_outbox_payload_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_outbox_payload_gin ON ai.outbox USING gin (payload);


--
-- Name: ix_outbox_status_scheduled; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_outbox_status_scheduled ON ai.outbox USING btree (status, scheduled_at);


--
-- Name: ix_outbox_tenant_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_outbox_tenant_created ON ai.outbox USING btree (tenant_key, created_at DESC);


--
-- Name: ix_prompt_versions_key_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_prompt_versions_key_created ON ai.prompt_versions USING btree (tenant_key, prompt_key, created_at DESC);


--
-- Name: ix_runs_input_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_runs_input_gin ON ai.runs USING gin (input);


--
-- Name: ix_runs_metrics_gin; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_runs_metrics_gin ON ai.runs USING gin (metrics);


--
-- Name: ix_runs_tenant_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_runs_tenant_created ON ai.runs USING btree (tenant_key, created_at DESC);


--
-- Name: ix_runs_tenant_status_created; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_runs_tenant_status_created ON ai.runs USING btree (tenant_key, status, created_at DESC);


--
-- Name: ix_runs_trace; Type: INDEX; Schema: ai; Owner: -
--

CREATE INDEX ix_runs_trace ON ai.runs USING btree (tenant_key, trace_id);


--
-- Name: ix_entity_links_meta_gin; Type: INDEX; Schema: registry; Owner: -
--

CREATE INDEX ix_entity_links_meta_gin ON registry.entity_links USING gin (meta);


--
-- Name: ix_entity_links_tenant_left; Type: INDEX; Schema: registry; Owner: -
--

CREATE INDEX ix_entity_links_tenant_left ON registry.entity_links USING btree (tenant_key, left_type, left_id);


--
-- Name: ix_entity_links_tenant_rel; Type: INDEX; Schema: registry; Owner: -
--

CREATE INDEX ix_entity_links_tenant_rel ON registry.entity_links USING btree (tenant_key, rel_type);


--
-- Name: ix_entity_links_tenant_right; Type: INDEX; Schema: registry; Owner: -
--

CREATE INDEX ix_entity_links_tenant_right ON registry.entity_links USING btree (tenant_key, right_type, right_id);


--
-- Name: ix_usage_events_meta_gin; Type: INDEX; Schema: usage; Owner: -
--

CREATE INDEX ix_usage_events_meta_gin ON usage.events USING gin (meta);


--
-- Name: ix_usage_events_tenant_ts; Type: INDEX; Schema: usage; Owner: -
--

CREATE INDEX ix_usage_events_tenant_ts ON usage.events USING btree (tenant_key, ts);


--
-- Name: ix_usage_events_tenant_type_ts; Type: INDEX; Schema: usage; Owner: -
--

CREATE INDEX ix_usage_events_tenant_type_ts ON usage.events USING btree (tenant_key, event_type, ts);


--
-- Name: actions actions_insight_id_fkey; Type: FK CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.actions
    ADD CONSTRAINT actions_insight_id_fkey FOREIGN KEY (insight_id) REFERENCES ai.insights(id) ON DELETE SET NULL;


--
-- Name: actions actions_run_id_fkey; Type: FK CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.actions
    ADD CONSTRAINT actions_run_id_fkey FOREIGN KEY (run_id) REFERENCES ai.runs(id) ON DELETE SET NULL;


--
-- Name: evaluations evaluations_prompt_version_id_fkey; Type: FK CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.evaluations
    ADD CONSTRAINT evaluations_prompt_version_id_fkey FOREIGN KEY (prompt_version_id) REFERENCES ai.prompt_versions(id) ON DELETE SET NULL;


--
-- Name: evaluations evaluations_run_id_fkey; Type: FK CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.evaluations
    ADD CONSTRAINT evaluations_run_id_fkey FOREIGN KEY (run_id) REFERENCES ai.runs(id) ON DELETE SET NULL;


--
-- Name: impact impact_action_id_fkey; Type: FK CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.impact
    ADD CONSTRAINT impact_action_id_fkey FOREIGN KEY (action_id) REFERENCES ai.actions(id) ON DELETE SET NULL;


--
-- Name: insights insights_run_id_fkey; Type: FK CONSTRAINT; Schema: ai; Owner: -
--

ALTER TABLE ONLY ai.insights
    ADD CONSTRAINT insights_run_id_fkey FOREIGN KEY (run_id) REFERENCES ai.runs(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

