-- Migration 002: Human decisions table
-- Records human oversight decisions before consequential agent actions.

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
alter table governance_decisions force row level security;

create policy "decisions_owner_all"
  on governance_decisions
  using (owner_id = current_user)
  with check (owner_id = current_user);

create index if not exists governance_decisions_resource_idx
  on governance_decisions (resource_id, owner_id);
