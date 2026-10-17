-- Roteiro do filme em motion: escrito pelo "diretor" (IA) ou pelo diretor
-- automático, guardado por período. O servidor grava (service role); a
-- família só lê.

create table public.story_films (
  vault_id uuid not null references public.vaults (id) on delete cascade,
  period text not null check (period ~ '^(\d{4}|tudo)$'),
  script jsonb not null,
  source text not null default 'template' check (source in ('ai', 'template')),
  source_key text check (char_length(source_key) <= 200),
  updated_at timestamptz not null default now(),
  primary key (vault_id, period),
  check (octet_length(script::text) <= 200000)
);
create trigger story_films_updated_at before update on public.story_films
  for each row execute function public.set_updated_at();
create trigger zz_story_films_demo_guard before insert or update or delete on public.story_films
  for each row execute function public.guard_demo_vault();
alter table public.story_films enable row level security;
create policy story_films_admin on public.story_films for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
create policy story_films_family_read on public.story_films for select to authenticated
  using (public.in_vault_family(vault_id));
