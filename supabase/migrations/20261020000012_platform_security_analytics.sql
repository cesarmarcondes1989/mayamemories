-- =====================================================================
-- Dono da plataforma: 2 fatores obrigatório + analytics da vitrine
--
-- Segurança: dados de negócio (interessados, planos, marca, analytics) só
-- com sessão verificada em 2 fatores (aal2 no JWT do Supabase). A trava está
-- no banco: mesmo um cookie roubado sem o segundo fator não lê nada.
--
-- Analytics: só da VITRINE (site público e funil de venda). Nada de dentro
-- dos baús das famílias. Sem IP guardado: só país/estado/cidade aproximados.
-- Identificador de visitante só com consentimento de cookies (LGPD).
-- =====================================================================

create or replace function public.is_platform_admin_strong()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_platform_admin() and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

drop policy plans_platform on public.plans;
create policy plans_platform on public.plans for all to authenticated
  using (public.is_platform_admin_strong()) with check (public.is_platform_admin_strong());
drop policy leads_platform on public.leads;
create policy leads_platform on public.leads for all to authenticated
  using (public.is_platform_admin_strong()) with check (public.is_platform_admin_strong());
drop policy settings_platform_update on public.app_settings;
create policy settings_platform_update on public.app_settings for update to authenticated
  using (public.is_platform_admin_strong()) with check (public.is_platform_admin_strong());

-- ------------------------------------------------- interessados: perfil
alter table public.leads
  add column age_range text check (age_range in ('18-24', '25-34', '35-44', '45-54', '55+')),
  add column persona text check (persona in ('mae_pai', 'gestante', 'avos', 'padrinhos', 'noivos', 'presente', 'outro')),
  add column utm jsonb not null default '{}'::jsonb,
  add column visitor_id uuid;

drop function public.submit_lead(text, text, text, text, text, text, text);
create or replace function public.submit_lead(
  p_name text, p_email text, p_phone text, p_kind text, p_plan_key text, p_message text, p_source text,
  p_age_range text default null, p_persona text default null, p_utm jsonb default '{}'::jsonb, p_visitor_id uuid default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_utm jsonb := '{}'::jsonb;
  k text;
begin
  if v_email is null and v_phone is null then
    raise exception 'contact required' using errcode = '22023';
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '1 day'
      and (email = v_email or phone = v_phone)) >= 3 then
    return;
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many requests' using errcode = '53400';
  end if;
  -- Só as chaves de campanha conhecidas, com tamanho limitado
  foreach k in array array['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer'] loop
    if jsonb_typeof(p_utm -> k) = 'string' then
      v_utm := v_utm || jsonb_build_object(k, left(p_utm ->> k, 120));
    end if;
  end loop;
  insert into public.leads (name, email, phone, kind, plan_key, message, source, age_range, persona, utm, visitor_id)
  values (left(trim(p_name), 120), v_email, v_phone,
          case when p_kind in ('child', 'event') then p_kind end,
          (select key from public.plans where key = p_plan_key),
          left(nullif(trim(p_message), ''), 1000), left(nullif(trim(p_source), ''), 120),
          case when p_age_range in ('18-24', '25-34', '35-44', '45-54', '55+') then p_age_range end,
          case when p_persona in ('mae_pai', 'gestante', 'avos', 'padrinhos', 'noivos', 'presente', 'outro') then p_persona end,
          v_utm, p_visitor_id);
end;
$$;

-- ------------------------------------------------------------ eventos
create table public.analytics_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event text not null check (event in
    ('page_view', 'plans_view', 'plan_click', 'cta_click', 'lead_form_start', 'lead_submit',
     'login_view', 'nfc_open', 'checkout_start', 'checkout_paid')),
  path text check (char_length(path) <= 200),
  visitor_id uuid,
  session_id uuid,
  referrer_host text check (char_length(referrer_host) <= 120),
  utm_source text check (char_length(utm_source) <= 120),
  utm_medium text check (char_length(utm_medium) <= 120),
  utm_campaign text check (char_length(utm_campaign) <= 120),
  utm_content text check (char_length(utm_content) <= 120),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  browser text check (char_length(browser) <= 40),
  os text check (char_length(os) <= 40),
  country text check (char_length(country) <= 2),
  region text check (char_length(region) <= 60),
  city text check (char_length(city) <= 80),
  plan_key text check (char_length(plan_key) <= 30),
  logged_in boolean not null default false
);
create index analytics_events_time_idx on public.analytics_events (occurred_at);
create index analytics_events_event_idx on public.analytics_events (event, occurred_at);

alter table public.analytics_events enable row level security;
-- Escrita só pelo backend (service role, que ignora RLS). Leitura: dono com 2 fatores.
create policy analytics_platform_read on public.analytics_events for select to authenticated
  using (public.is_platform_admin_strong());
revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;

-- Resumo para o painel (tudo agregado no banco)
create or replace function public.platform_analytics(p_days int default 30)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_from timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
                        - make_interval(days => greatest(1, least(p_days, 400)) - 1);
  v_prev timestamptz := v_from - make_interval(days => greatest(1, least(p_days, 400)));
  result jsonb;
begin
  if not public.is_platform_admin_strong() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with ev as (
    select *, coalesce(session_id::text, 'e' || id) as sess
    from public.analytics_events where occurred_at >= v_from
  ), pv as (select * from ev where event = 'page_view')
  select jsonb_build_object(
    'from', v_from,
    'totals', jsonb_build_object(
      'page_views', (select count(*) from pv),
      'sessions', (select count(distinct sess) from pv),
      'visitors', (select count(distinct visitor_id) from pv where visitor_id is not null),
      'consented_share', (select round(100.0 * count(*) filter (where visitor_id is not null) / nullif(count(*), 0)) from pv),
      'leads', (select count(*) from public.leads where created_at >= v_from),
      'leads_prev', (select count(*) from public.leads where created_at >= v_prev and created_at < v_from),
      'sessions_prev', (select count(distinct coalesce(session_id::text, 'e' || id)) from public.analytics_events
                        where event = 'page_view' and occurred_at >= v_prev and occurred_at < v_from)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'sessions', coalesce(x.sessions, 0), 'leads', coalesce(l.leads, 0)) order by d.day), '[]')
      from generate_series((v_from at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') as d(day)
      left join (select (occurred_at at time zone 'America/Sao_Paulo')::date as day, count(distinct sess) as sessions from pv group by 1) x on x.day = d.day
      left join (select (created_at at time zone 'America/Sao_Paulo')::date as day, count(*) as leads from public.leads where created_at >= v_from group by 1) l on l.day = d.day
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Visitou o site', 'sessions', (select count(distinct sess) from pv)),
      jsonb_build_object('step', 'Viu os planos', 'sessions', (select count(distinct sess) from ev where event = 'plans_view')),
      jsonb_build_object('step', 'Escolheu um plano', 'sessions', (select count(distinct sess) from ev where event = 'plan_click')),
      jsonb_build_object('step', 'Começou o formulário', 'sessions', (select count(distinct sess) from ev where event = 'lead_form_start')),
      jsonb_build_object('step', 'Virou interessado', 'sessions', (select count(distinct sess) from ev where event = 'lead_submit'))
    ),
    'plans', (select coalesce(jsonb_agg(jsonb_build_object('label', plan_key, 'n', n) order by n desc), '[]')
              from (select plan_key, count(distinct sess) n from ev where event = 'plan_click' and plan_key is not null group by 1) t),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]') from (
                  select coalesce(utm_source, referrer_host, 'direto') as label, count(distinct sess) n from pv group by 1 order by 2 desc limit 12) t),
    'campaigns', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n, 'leads', leads) order by n desc), '[]') from (
                  select utm_campaign as label, count(distinct sess) n,
                         count(distinct sess) filter (where sess in (select sess from ev where event = 'lead_submit')) leads
                  from ev where utm_campaign is not null group by 1 order by 2 desc limit 12) t),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]') from (
                  select coalesce(device, '?') label, count(distinct sess) n from pv group by 1) t),
    'browsers', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]') from (
                  select coalesce(browser, '?') label, count(distinct sess) n from pv group by 1 order by 2 desc limit 8) t),
    'os', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]') from (
                  select coalesce(os, '?') label, count(distinct sess) n from pv group by 1 order by 2 desc limit 8) t),
    'regions', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]') from (
                  select concat_ws(' · ', nullif(region, ''), nullif(country, '')) as label, count(distinct sess) n
                  from pv where country is not null group by 1 order by 2 desc limit 12) t),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]') from (
                  select concat_ws(', ', city, region) as label, count(distinct sess) n
                  from pv where city is not null group by 1 order by 2 desc limit 12) t),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('label', path, 'n', n) order by n desc), '[]') from (
                  select path, count(*) n from pv group by 1 order by 2 desc limit 10) t),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'n', coalesce(n, 0)) order by h), '[]') from generate_series(0, 23) h
              left join (select extract(hour from occurred_at at time zone 'America/Sao_Paulo')::int hr, count(distinct sess) n from pv group by 1) t on t.hr = h),
    'personas', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]') from (
                  select coalesce(persona, 'não informado') label, count(*) n from public.leads where created_at >= v_from group by 1) t),
    'ages', (select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by label), '[]') from (
                  select coalesce(age_range, 'não informado') label, count(*) n from public.leads where created_at >= v_from group by 1) t),
    'business', jsonb_build_object(
      'vaults', (select count(*) from public.vaults where status <> 'archived'),
      'vaults_new', (select count(*) from public.vaults where created_at >= v_from),
      'event_vaults', (select count(*) from public.vaults where kind = 'event' and status <> 'archived'),
      'people', (select count(*) from public.people where status = 'active'),
      'memories_new', (select count(*) from public.memories where created_at >= v_from and deleted_at is null)
    )
  ) into result;
  return result;
end;
$$;

-- Retenção: eventos brutos por 13 meses (rodar mensalmente)
create or replace function public.analytics_prune()
returns int
language sql security definer
set search_path = ''
as $$
  with d as (delete from public.analytics_events where occurred_at < now() - interval '13 months' returning 1)
  select count(*)::int from d
$$;

revoke execute on function
  public.is_platform_admin_strong(), public.platform_analytics(int), public.analytics_prune(),
  public.submit_lead(text, text, text, text, text, text, text, text, text, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.is_platform_admin_strong(), public.platform_analytics(int) to authenticated;
grant execute on function public.submit_lead(text, text, text, text, text, text, text, text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.analytics_prune() to service_role;
