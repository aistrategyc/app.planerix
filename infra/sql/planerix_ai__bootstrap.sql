-- schemas
create schema if not exists ai;
create schema if not exists usage;
create schema if not exists registry;

-- registry
create table if not exists registry.entity_links (
  id bigserial primary key,
  tenant_key text not null,
  left_type text not null,
  left_id text not null,
  rel_type text not null,
  right_type text not null,
  right_id text not null,
  weight numeric null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ix_entity_links_tenant_left  on registry.entity_links (tenant_key, left_type, left_id);
create index if not exists ix_entity_links_tenant_right on registry.entity_links (tenant_key, right_type, right_id);
create index if not exists ix_entity_links_tenant_rel   on registry.entity_links (tenant_key, rel_type);
create index if not exists ix_entity_links_meta_gin     on registry.entity_links using gin (meta);

-- usage
create table if not exists usage.events (
  id bigserial primary key,
  tenant_key text not null,
  actor_type text null,
  actor_id text null,
  event_type text not null,
  provider text null,
  model text null,
  units numeric null,
  unit_type text null,
  cost_usd numeric null,
  meta jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);
create index if not exists ix_usage_events_tenant_ts      on usage.events (tenant_key, ts);
create index if not exists ix_usage_events_tenant_type_ts on usage.events (tenant_key, event_type, ts);
create index if not exists ix_usage_events_meta_gin       on usage.events using gin (meta);

-- enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'ai_run_status') then
    create type ai.ai_run_status as enum ('queued','running','succeeded','failed','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_action_status') then
    create type ai.ai_action_status as enum ('proposed','approved','executing','done','failed','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_outbox_status') then
    create type ai.ai_outbox_status as enum ('pending','processing','sent','failed','dead');
  end if;
end $$;

-- agent_registry
create table if not exists ai.agent_registry (
  id bigserial primary key,
  tenant_key text not null,
  agent_name text not null,
  agent_version text not null default 'v1',
  is_enabled boolean not null default true,
  schedule text null,
  default_inputs jsonb not null default '{}'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_key, agent_name, agent_version)
);
create index if not exists ix_agent_registry_tenant_agent on ai.agent_registry (tenant_key, agent_name);

-- prompt_versions
create table if not exists ai.prompt_versions (
  id bigserial primary key,
  tenant_key text not null,
  prompt_key text not null,
  version text not null,
  content text not null,
  params jsonb not null default '{}'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  unique (tenant_key, prompt_key, version)
);
create index if not exists ix_prompt_versions_key_created on ai.prompt_versions (tenant_key, prompt_key, created_at desc);

-- memory_refs
create table if not exists ai.memory_refs (
  id bigserial primary key,
  tenant_key text not null,
  memory_type text not null,
  scope text null,
  entity_type text null,
  entity_id text null,
  qdrant_collection text not null,
  qdrant_point_id text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ix_memory_refs_tenant_type_created on ai.memory_refs (tenant_key, memory_type, created_at desc);
create index if not exists ix_memory_refs_entity             on ai.memory_refs (tenant_key, entity_type, entity_id);
create index if not exists ix_memory_refs_meta_gin           on ai.memory_refs using gin (meta);

-- runs
create table if not exists ai.runs (
  id bigserial primary key,
  tenant_key text not null,
  agent_name text not null,
  agent_version text not null default 'v1',
  status ai.ai_run_status not null default 'queued',
  trigger text null,
  request_id text null,
  trace_id text null,
  model text null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists ix_runs_tenant_created        on ai.runs (tenant_key, created_at desc);
create index if not exists ix_runs_tenant_status_created on ai.runs (tenant_key, status, created_at desc);
create index if not exists ix_runs_trace                 on ai.runs (tenant_key, trace_id);
create index if not exists ix_runs_input_gin             on ai.runs using gin (input);
create index if not exists ix_runs_metrics_gin           on ai.runs using gin (metrics);

-- insights
create table if not exists ai.insights (
  id bigserial primary key,
  tenant_key text not null,
  run_id bigint null references ai.runs(id) on delete set null,
  insight_type text not null,
  severity smallint null,
  title text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  entity_type text null,
  entity_id text null,
  valid_from timestamptz null,
  valid_to timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists ix_insights_tenant_created      on ai.insights (tenant_key, created_at desc);
create index if not exists ix_insights_tenant_type_created on ai.insights (tenant_key, insight_type, created_at desc);
create index if not exists ix_insights_entity              on ai.insights (tenant_key, entity_type, entity_id);
create index if not exists ix_insights_details_gin         on ai.insights using gin (details);
create index if not exists ix_insights_evidence_gin        on ai.insights using gin (evidence);

-- actions
create table if not exists ai.actions (
  id bigserial primary key,
  tenant_key text not null,
  run_id bigint null references ai.runs(id) on delete set null,
  insight_id bigint null references ai.insights(id) on delete set null,
  action_type text not null,
  status ai.ai_action_status not null default 'proposed',
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  due_at timestamptz null,
  executed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists ix_actions_tenant_status_created on ai.actions (tenant_key, status, created_at desc);
create index if not exists ix_actions_tenant_type_created   on ai.actions (tenant_key, action_type, created_at desc);
create index if not exists ix_actions_payload_gin           on ai.actions using gin (payload);

-- impact
create table if not exists ai.impact (
  id bigserial primary key,
  tenant_key text not null,
  action_id bigint null references ai.actions(id) on delete set null,
  metric_key text not null,
  baseline_value numeric null,
  measured_value numeric null,
  delta_value numeric null,
  measured_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);
create index if not exists ix_impact_tenant_metric_measured on ai.impact (tenant_key, metric_key, measured_at desc);
create index if not exists ix_impact_meta_gin              on ai.impact using gin (meta);

-- evaluations
create table if not exists ai.evaluations (
  id bigserial primary key,
  tenant_key text not null,
  run_id bigint null references ai.runs(id) on delete set null,
  prompt_version_id bigint null references ai.prompt_versions(id) on delete set null,
  eval_type text not null default 'human',
  score numeric null,
  rubric jsonb not null default '{}'::jsonb,
  notes text null,
  created_at timestamptz not null default now()
);
create index if not exists ix_evals_tenant_created on ai.evaluations (tenant_key, created_at desc);
create index if not exists ix_evals_rubric_gin    on ai.evaluations using gin (rubric);

-- outbox
create table if not exists ai.outbox (
  id bigserial primary key,
  tenant_key text not null,
  event_type text not null,
  status ai.ai_outbox_status not null default 'pending',
  scheduled_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);
create index if not exists ix_outbox_status_scheduled on ai.outbox (status, scheduled_at);
create index if not exists ix_outbox_tenant_created   on ai.outbox (tenant_key, created_at desc);
create index if not exists ix_outbox_payload_gin      on ai.outbox using gin (payload);
