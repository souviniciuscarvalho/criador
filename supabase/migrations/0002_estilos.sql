create table if not exists criador_styles (
  workspace text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

create table if not exists criador_prints (
  workspace text not null,
  style_id text not null,
  idx int not null,
  data text not null,
  primary key (workspace, style_id, idx)
);

alter table criador_styles enable row level security;
alter table criador_prints enable row level security;
