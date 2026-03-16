-- Migration 001: Agent audit log
-- Immutable append-only record of all agent actions.

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

alter table agent_audit_log enable row level security;
alter table agent_audit_log force row level security;

create policy "audit_log_owner_select"
  on agent_audit_log for select
  using (owner_id = current_user);

create index if not exists agent_audit_log_owner_ts_idx
  on agent_audit_log (owner_id, ts desc);

create index if not exists agent_audit_log_resource_idx
  on agent_audit_log (resource_id);
