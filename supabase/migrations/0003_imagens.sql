create table if not exists criador_kv (
  workspace text not null,
  k text not null,
  v text not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, k)
);

create table if not exists criador_images (
  workspace text not null,
  content_id text not null,
  slide_id text not null,
  data text not null,
  created_at timestamptz not null default now(),
  primary key (workspace, content_id, slide_id)
);

alter table criador_kv enable row level security;
alter table criador_images enable row level security;
