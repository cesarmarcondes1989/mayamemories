-- =====================================================================
-- Livro e filme do ano: textos de cada capítulo, 100% automáticos
-- * Escritos por IA em segundo plano quando alguém abre o livro/filme, e
--   reescritos sozinhos quando o capítulo ganha memórias novas (source_key).
-- * Sem IA (desligada no baú ou sem chave), entra um texto-modelo.
-- * Quem cuida do baú pode desligar a IA ou editar um texto (vira 'edited'
--   e não é mais sobrescrito) — opcional, nunca obrigatório.
-- =====================================================================

alter table public.vaults add column ai_enabled boolean not null default true;

create table public.story_texts (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults (id) on delete cascade,
  period text not null check (period ~ '^(\d{4}|tudo)$'),
  section text not null check (section ~ '^[a-z0-9-]{2,40}$'),
  body text not null check (char_length(body) between 1 and 4000),
  source text not null default 'ai' check (source in ('ai', 'template', 'edited')),
  -- assinatura do conteúdo usado (memórias do capítulo); mudou => reescreve
  source_key text check (char_length(source_key) <= 200),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vault_id, period, section)
);
create trigger story_texts_updated_at before update on public.story_texts
  for each row execute function public.set_updated_at();
create trigger story_texts_freeze_vault before update on public.story_texts
  for each row execute function public.freeze_vault_id();
create trigger zz_story_texts_demo_guard before insert or update or delete on public.story_texts
  for each row execute function public.guard_demo_vault();

alter table public.story_texts enable row level security;
create policy story_texts_admin on public.story_texts for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
-- A família vê os textos (o filme e o livro também são dela)
create policy story_texts_family_read on public.story_texts for select to authenticated
  using (public.in_vault_family(vault_id));

-- ---------------------------------------------------------------------
-- Curadoria automática ("conselho da família")
-- * story_settings (só administradores leem): o que a família escreveu
--   ("não coloque nada do tio", "a tia faleceu, priorize ela") e as regras
--   que a IA extraiu disso. Exclusão é aplicada por código.
-- * story_selections: quais memórias entraram no livro/filme e por quê.
-- ---------------------------------------------------------------------
create table public.story_settings (
  vault_id uuid primary key references public.vaults (id) on delete cascade,
  guidance text check (char_length(guidance) <= 2000),
  rules jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
create trigger story_settings_updated_at before update on public.story_settings
  for each row execute function public.set_updated_at();
create trigger zz_story_settings_demo_guard before insert or update or delete on public.story_settings
  for each row execute function public.guard_demo_vault();
alter table public.story_settings enable row level security;
create policy story_settings_admin on public.story_settings for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));

create table public.story_selections (
  vault_id uuid not null references public.vaults (id) on delete cascade,
  period text not null check (period ~ '^(\d{4}|tudo)$'),
  kind text not null check (kind in ('book', 'film')),
  memory_ids uuid[] not null default '{}',
  rationale text check (char_length(rationale) <= 4000),
  source_key text check (char_length(source_key) <= 200),
  method text not null default 'all' check (method in ('all', 'rules', 'ai_panel', 'pending')),
  updated_at timestamptz not null default now(),
  primary key (vault_id, period, kind)
);
create trigger story_selections_updated_at before update on public.story_selections
  for each row execute function public.set_updated_at();
create trigger zz_story_selections_demo_guard before insert or update or delete on public.story_selections
  for each row execute function public.guard_demo_vault();
alter table public.story_selections enable row level security;
create policy story_selections_admin on public.story_selections for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
create policy story_selections_family_read on public.story_selections for select to authenticated
  using (public.in_vault_family(vault_id));
