-- =====================================================================
-- Vitrine: planos configuráveis, interessados (leads) e marca
-- Preços em centavos e NULL = "a definir" (mostra "Fale com a gente").
-- =====================================================================

alter table public.app_settings
  add column brand_name text not null default 'Baú de Memórias' check (char_length(brand_name) between 1 and 60),
  add column brand_slogan text not null default 'Memórias de família que esperam a hora certa de serem descobertas.' check (char_length(brand_slogan) <= 160),
  add column contact_whatsapp text check (contact_whatsapp is null or contact_whatsapp ~ '^[0-9]{10,15}$'),
  add column contact_email text;

create table public.plans (
  key text primary key check (key ~ '^[a-z0-9_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 60),
  tagline text check (char_length(tagline) <= 160),
  audience text not null default 'child' check (audience in ('child', 'event', 'any')),
  billing text not null check (billing in ('free', 'subscription', 'one_time')),
  price_monthly_cents int check (price_monthly_cents >= 0),
  price_yearly_cents int check (price_yearly_cents >= 0),
  price_once_cents int check (price_once_cents >= 0),
  features jsonb not null default '[]'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  highlight boolean not null default false,
  sort_order int not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger plans_updated_at before update on public.plans for each row execute function public.set_updated_at();

insert into public.plans (key, name, tagline, audience, billing, features, limits, highlight, sort_order) values
  ('gratis', 'Grátis', 'Para conhecer sem compromisso', 'any', 'free',
   '["1 baú", "Até 5 convidados", "Fotos, áudios e cartas", "1 cápsula do tempo"]',
   '{"vaults": 1, "guests": 5, "storage_gb": 1}', false, 10),
  ('ninho', 'Ninho', 'O essencial para guardar a história de uma criança', 'child', 'subscription',
   '["1 baú", "Até 30 convidados", "Linha do tempo e cápsulas ilimitadas", "Cartas para o futuro com bloqueio real", "Todos os temas de cor"]',
   '{"vaults": 1, "guests": 30, "storage_gb": 20}', false, 20),
  ('familia', 'Família', 'Para famílias grandes e mais de um filho', 'child', 'subscription',
   '["Até 3 baús (um por filho)", "Convidados ilimitados", "Vídeos mais longos", "1 ursinho NFC incluso", "Foto de capa e boas-vindas personalizadas"]',
   '{"vaults": 3, "guests": null, "storage_gb": 100}', true, 30),
  ('legado', 'Legado', 'A história inteira, do primeiro ultrassom aos 18 anos', 'child', 'one_time',
   '["Tudo do Família", "Filme do ano montado com as memórias", "Livro impresso anual", "2 ursinhos NFC inclusos", "Pendrive com tudo aos 15 e aos 18 anos", "O baú passa para a criança aos 18"]',
   '{"vaults": 3, "guests": null, "storage_gb": 300}', false, 40),
  ('evento', 'Evento', 'Casamento, chá de bebê, 15 anos', 'event', 'one_time',
   '["Convidados entram pelo QR ou NFC da mesa, sem cadastro", "Fotos, vídeos e áudios da festa num só lugar", "Filme e álbum do evento ao final", "Acesso para sempre depois da festa"]',
   '{"vaults": 1, "guests": null, "storage_gb": 50, "collection_days": 120}', false, 50);

-- Preços sugeridos de lançamento (editáveis em /plataforma/planos)
update public.plans set price_monthly_cents = 1990, price_yearly_cents = 19900 where key = 'ninho';
update public.plans set price_monthly_cents = 3490, price_yearly_cents = 34900 where key = 'familia';
update public.plans set price_once_cents = 149000 where key = 'legado';
update public.plans set price_once_cents = 39000 where key = 'evento';

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^[0-9]{10,15}$'),
  kind text check (kind in ('child', 'event')),
  plan_key text references public.plans (key) on delete set null,
  message text check (char_length(message) <= 1000),
  source text check (char_length(source) <= 120),
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'lost')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contact check (email is not null or phone is not null)
);
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.leads enable row level security;

-- Vitrine pública: planos ativos e a marca
create policy plans_public_read on public.plans for select to anon, authenticated using (active);
create policy plans_platform on public.plans for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.plans, public.leads from anon;
grant select on public.plans to anon;

create policy leads_platform on public.leads for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Marca pública (somente o necessário para a vitrine)
create or replace function public.public_brand()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('brand_name', brand_name, 'brand_slogan', brand_slogan,
                            'contact_whatsapp', contact_whatsapp, 'contact_email', contact_email)
  from public.app_settings where id
$$;

-- Formulário "quero o meu" (sem login). Limite simples contra abuso.
create or replace function public.submit_lead(
  p_name text, p_email text, p_phone text, p_kind text, p_plan_key text, p_message text, p_source text
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if v_email is null and v_phone is null then
    raise exception 'contact required' using errcode = '22023';
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '1 day'
      and (email = v_email or phone = v_phone)) >= 3 then
    return; -- já recebemos; silencioso
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many requests' using errcode = '53400';
  end if;
  insert into public.leads (name, email, phone, kind, plan_key, message, source)
  values (left(trim(p_name), 120), v_email, v_phone,
          case when p_kind in ('child', 'event') then p_kind end,
          (select key from public.plans where key = p_plan_key),
          left(nullif(trim(p_message), ''), 1000), left(nullif(trim(p_source), ''), 120));
end;
$$;

revoke execute on function public.public_brand(), public.submit_lead(text, text, text, text, text, text, text) from public;
grant execute on function public.public_brand(), public.submit_lead(text, text, text, text, text, text, text) to anon, authenticated;
