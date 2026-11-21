-- Criador: dados por "workspace" (hash SHA-256 do link MCP). Acesso só pelo servidor (service role).
create table if not exists criador_workspaces (
  workspace text primary key,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists criador_references (
  workspace text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

create table if not exists criador_contents (
  workspace text not null,
  id text not null,
  data jsonb not null,
  source text not null default 'claude',
  created_at timestamptz not null default now(),
  primary key (workspace, id)
);

alter table criador_workspaces enable row level security;
alter table criador_references enable row level security;
alter table criador_contents enable row level security;
-- Sem policies: anon/authenticated não leem nada; só a service role (servidor) acessa.
