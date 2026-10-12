-- =====================================================================
-- Maya Memories — esquema principal
-- Convenções:
--   * UUID como identificador interno; identificadores públicos aleatórios.
--   * Status em texto + CHECK (extensível sem recriar enums).
--   * Toda tabela privada recebe RLS na migração 0002 (negado por padrão).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Utilitário: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Configurações do projeto (linha única)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  project_title text not null default 'Maya Memories',
  subject_name text not null default 'Maya',
  expected_birth_date date,
  birth_date date,
  public_landing_enabled boolean not null default true,
  require_comment_moderation boolean not null default true,
  -- Limites em configuração, não espalhados pelo código.
  upload_limits jsonb not null default '{
    "image":    {"max_bytes": 20971520,  "mime": ["image/jpeg","image/png","image/webp","image/heic","image/heif","image/gif"]},
    "video":    {"max_bytes": 209715200, "max_seconds": 600, "mime": ["video/mp4","video/quicktime","video/webm"]},
    "audio":    {"max_bytes": 52428800,  "max_seconds": 900, "mime": ["audio/webm","audio/mp4","audio/mpeg","audio/ogg","audio/wav","audio/x-wav","audio/aac","audio/x-m4a"]},
    "document": {"max_bytes": 20971520,  "mime": ["application/pdf","image/jpeg","image/png"]},
    "max_files_per_memory": 10,
    "max_bytes_per_person": 5368709120
  }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.app_settings (id) values (true);

-- ---------------------------------------------------------------------
-- Perfis (ligados ao Supabase Auth) — mínimo de dados pessoais
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  avatar_path text,
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Tipos de relacionamento configuráveis (não presumir estrutura familiar)
create table public.relationship_types (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  label text not null,
  sort_order int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.relationship_types (key, label, sort_order) values
  ('mae', 'Mãe', 10), ('pai', 'Pai', 11), ('avo', 'Avós', 20), ('tio', 'Tios', 30),
  ('primo', 'Primos', 40), ('padrinho', 'Padrinhos', 45), ('amigo_familia', 'Amigos da família', 50),
  ('amigo', 'Amigos pessoais', 60), ('maya', 'Maya', 1), ('outro', 'Outros', 99);

-- Pessoas do universo da Maya (podem existir antes de ativar conta)
create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 120),
  relationship_type text not null default 'outro' references public.relationship_types (key),
  profile_id uuid unique references public.profiles (id) on delete set null,
  avatar_path text,
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'archived')),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();

-- Papéis com escopo explícito
create table public.person_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'contributor', 'future_subject')),
  scope text not null default 'global',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id)
);
create unique index person_roles_active_uniq on public.person_roles (profile_id, role, scope)
  where revoked_at is null;

-- Grupos de acesso ("Família autorizada" e outros)
create table public.access_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_default_family boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create unique index access_groups_single_family on public.access_groups (is_default_family)
  where is_default_family;
insert into public.access_groups (name, description, is_default_family)
values ('Família autorizada', 'Pessoas que podem ver memórias marcadas como "Família autorizada".', true);

create table public.access_group_members (
  group_id uuid not null references public.access_groups (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (group_id, person_id)
);

-- ---------------------------------------------------------------------
-- Convites (segredo guardado apenas como hash SHA-256)
-- ---------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash bytea not null unique,
  access_group_id uuid references public.access_groups (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_profile_id uuid references public.profiles (id),
  revoked_at timestamptz,
  last_sent_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index invitations_email_idx on public.invitations (lower(email)) where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------
-- Tokens NFC — porta de entrada, nunca chave mestra
-- ---------------------------------------------------------------------
create table public.nfc_tokens (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  person_id uuid references public.people (id) on delete set null,
  invitation_id uuid references public.invitations (id) on delete set null,
  label text check (char_length(label) <= 120),
  status text not null default 'prepared' check (status in ('prepared', 'active', 'suspended', 'revoked', 'replaced')),
  notes text check (char_length(notes) <= 1000),
  activated_at timestamptz,
  revoked_at timestamptz,
  replaced_by_token_id uuid references public.nfc_tokens (id),
  last_scanned_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger nfc_tokens_updated_at before update on public.nfc_tokens
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Memórias (registro lógico) e mídia
-- ---------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  title text check (char_length(title) <= 200),
  description text check (char_length(description) <= 20000),
  memory_type text not null check (memory_type in
    ('photo', 'album', 'video', 'audio', 'text', 'letter', 'visit', 'milestone', 'drawing', 'mixed')),
  author_person_id uuid not null references public.people (id),
  created_by_profile_id uuid not null references public.profiles (id),
  occurred_at date,
  visibility text not null default 'family' check (visibility in ('private', 'family', 'selected', 'capsule', 'public')),
  moderation_status text not null default 'draft' check (moderation_status in
    ('draft', 'uploading', 'processing', 'pending_review', 'approved', 'changes_requested', 'rejected', 'hidden', 'removed')),
  moderation_note text check (char_length(moderation_note) <= 2000),
  -- Cartas para o futuro: não visíveis antes desta data (exceto autor/admin)
  unlock_at timestamptz,
  recipient text check (char_length(recipient) <= 120),
  requested_capsule_id uuid,
  is_highlight boolean not null default false,
  timeline_position int,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index memories_status_idx on public.memories (moderation_status) where deleted_at is null;
create index memories_timeline_idx on public.memories (occurred_at, created_at) where deleted_at is null;
create index memories_author_idx on public.memories (author_person_id);
create index memories_creator_idx on public.memories (created_by_profile_id);
create trigger memories_updated_at before update on public.memories
  for each row execute function public.set_updated_at();

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video', 'audio', 'document')),
  -- Caminho no bucket privado; NUNCA uma URL pública
  storage_path text not null unique check (storage_path !~ '^https?://'),
  original_filename text check (char_length(original_filename) <= 255),
  mime_type text not null,
  size_bytes bigint check (size_bytes >= 0),
  duration_seconds numeric(10, 2),
  width int,
  height int,
  position int not null default 0,
  processing_status text not null default 'pending_upload' check (processing_status in
    ('pending_upload', 'uploaded', 'processing', 'ready', 'failed', 'deleted')),
  failure_reason text,
  checksum text,
  created_by_profile_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_memory_idx on public.media_assets (memory_id);
create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();

create table public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  author_person_id uuid not null references public.people (id),
  created_by_profile_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'hidden', 'removed')),
  moderated_by uuid references public.profiles (id),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index memory_comments_memory_idx on public.memory_comments (memory_id);
create trigger memory_comments_updated_at before update on public.memory_comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Visitas presenciais (registro explícito; acessar o NFC NÃO cria visita)
-- ---------------------------------------------------------------------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id),
  occurred_at date not null,
  registered_at timestamptz not null default now(),
  visit_type text not null check (visit_type in ('home', 'maternity', 'outing', 'family_gathering', 'celebration', 'other')),
  message text check (char_length(message) <= 4000),
  companions text check (char_length(companions) <= 500),
  memory_id uuid references public.memories (id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'hidden', 'removed')),
  created_by uuid not null references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_person_idx on public.visits (person_id, occurred_at desc);
create trigger visits_updated_at before update on public.visits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Cápsulas do tempo
-- ---------------------------------------------------------------------
create table public.capsules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  theme text check (char_length(theme) <= 200),
  capsule_type text not null default 'special' check (capsule_type in
    ('pregnancy', 'birth', 'growth', 'letters', 'special', 'fifteen')),
  opens_at timestamptz,
  opening_rule text not null default 'date' check (opening_rule in ('date', 'manual', 'date_and_manual')),
  -- draft: em montagem (invisível a não-admins); scheduled: aguardando condição;
  -- sealed: fechada manualmente (sobrepõe a data); opened: aberta manualmente; archived.
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sealed', 'eligible_to_open', 'opened', 'archived')),
  visibility_policy text not null default 'family' check (visibility_policy in ('family', 'selected', 'admins')),
  created_by uuid references public.profiles (id),
  opened_at timestamptz,
  opened_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capsule_date_rule_needs_date check (opening_rule = 'manual' or opens_at is not null or status = 'draft')
);
create trigger capsules_updated_at before update on public.capsules
  for each row execute function public.set_updated_at();

alter table public.memories
  add constraint memories_requested_capsule_fk foreign key (requested_capsule_id)
  references public.capsules (id) on delete set null;

create table public.capsule_items (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules (id) on delete cascade,
  memory_id uuid not null references public.memories (id) on delete cascade,
  position int not null default 0,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (capsule_id, memory_id)
);
create index capsule_items_memory_idx on public.capsule_items (memory_id);

-- ---------------------------------------------------------------------
-- Consentimentos (finalidade + versão de política)
-- ---------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  consent_type text not null check (consent_type in ('contribution_terms', 'email_notifications', 'image_of_third_parties')),
  purpose text not null,
  status text not null check (status in ('granted', 'withdrawn')),
  policy_version text not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  recorded_by uuid references public.profiles (id),
  -- clock_timestamp: a ordem dos registros vale mesmo dentro da mesma transação
  created_at timestamptz not null default clock_timestamp()
);
create index consents_person_idx on public.consents (person_id, consent_type, created_at desc);

-- ---------------------------------------------------------------------
-- Permissões específicas por recurso
-- ---------------------------------------------------------------------
create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  grantee_profile_id uuid references public.profiles (id) on delete cascade,
  grantee_group_id uuid references public.access_groups (id) on delete cascade,
  resource_type text not null check (resource_type in ('memory', 'capsule')),
  resource_id uuid not null,
  permission text not null default 'view' check (permission in ('view')),
  granted_by uuid references public.profiles (id),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint access_grants_one_grantee check ((grantee_profile_id is null) <> (grantee_group_id is null))
);
create index access_grants_resource_idx on public.access_grants (resource_type, resource_id) where revoked_at is null;

-- ---------------------------------------------------------------------
-- Pedidos de exclusão de dados
-- ---------------------------------------------------------------------
create table public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles (id),
  memory_id uuid references public.memories (id) on delete set null,
  reason text check (char_length(reason) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'completed', 'declined')),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Auditoria (append-only)
-- ---------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_resource_idx on public.audit_events (resource_type, resource_id);

-- ---------------------------------------------------------------------
-- Notificações (outbox consumida pelo n8n)
-- ---------------------------------------------------------------------
create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  on_contribution_reviewed boolean not null default true,
  on_capsule_opening boolean not null default true,
  on_new_memories_digest boolean not null default false,
  gentle_reminders boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient_profile_id uuid references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_jobs_pending_idx on public.notification_jobs (available_at) where status in ('pending', 'processing');
