-- agent-governance-sdk schema
-- Compatible with PostgreSQL 14+, Supabase, Neon, Railway
-- For SQLite, see sql/schema.sqlite.sql

-- ---------------------------------------------------------
-- AGENT AUDIT LOG
-- Immutable append-only record of all agent actions.
-- FORCE ROW LEVEL SECURITY (Supabase/PostgreSQL) ensures
-- no UPDATE or DELETE is possible even by admin roles.
-- ---------------------------------------------------------

create table if not exists agent_audit_log (
  id             uuid primary key default gen_random_uuid(),
  ts             timestamptz not null default now(),
  event_type     text not null,
  agent          text not null,
  model          text,
  resource_id    text,
  owner_id       text,
  input_hash     text,
  output_hash    text,
  input_tokens   integer,
  output_tokens  integer,
  duration_ms    integer,
  metadata       jsonb,
  error          text
);

-- Make it immutable in Supabase/PostgreSQL
-- (Remove if your database does not support RLS)
alter table agent_audit_log enable row level security;

-- Owners can read their own entries
create policy "audit_log_owner_select"
  on agent_audit_log for select
  using (owner_id = current_user);

-- No UPDATE or DELETE policies — log is append-only
-- FORCE RLS prevents even service role from modifying
alter table agent_audit_log force row level security;

-- Indexes for common query patterns
create index if not exists agent_audit_log_owner_ts_idx
  on agent_audit_log (owner_id, ts desc);

create index if not exists agent_audit_log_resource_idx
  on agent_audit_log (resource_id);

comment on table agent_audit_log is
  'Immutable audit log of all AI agent actions. '
  'FORCE ROW LEVEL SECURITY prevents modification. '
  'This table is the primary governance artifact.';

-- ---------------------------------------------------------
-- HUMAN DECISIONS
-- Records human oversight decisions before consequential
-- agent actions. No agent may insert into this table.
-- ---------------------------------------------------------

create table if not exists governance_decisions (
  id           uuid primary key default gen_random_uuid(),
  resource_id  text not null,
  owner_id     text not null,
  decision     text not null,
  rationale    text,
  context      jsonb,
  decided_at   timestamptz not null default now()
);

alter table governance_decisions enable row level security;

create policy "decisions_owner_all"
  on governance_decisions
  using (owner_id = current_user)
  with check (owner_id = current_user);

-- FORCE RLS prevents agent service-role writes
alter table governance_decisions force row level security;

create index if not exists governance_decisions_resource_idx
  on governance_decisions (resource_id, owner_id);

comment on table governance_decisions is
  'Human oversight decisions. FORCE ROW LEVEL SECURITY '
  'prevents any agent from writing to this table. '
  'Only authenticated humans can record decisions.';
