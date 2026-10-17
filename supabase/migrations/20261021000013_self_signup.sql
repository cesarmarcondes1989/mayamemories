-- =====================================================================
-- Cadastro aberto: a pessoa cria a conta e o baú (Grátis) e já usa.
-- * Conta criada pelo site nasce com app_metadata.email_verified = false.
--   Enquanto não confirmar o e-mail (clicando no link), ela usa o próprio
--   baú normalmente, mas o e-mail dela NÃO vale para aceitar convites de
--   outros baús (auth_email() devolve null). Assim ninguém "pega" o convite
--   da vovó cadastrando o e-mail dela.
-- * Limite de baús por conta no autoatendimento (padrão 1, do plano Grátis)
--   e freio contra criação em massa.
-- =====================================================================

create or replace function public.auth_email()
returns text
language sql stable security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and coalesce((u.raw_app_meta_data ->> 'email_verified')::boolean, true)
$$;

alter table public.app_settings
  add column self_service_vault_limit int not null default 1 check (self_service_vault_limit between 0 and 50);
update public.app_settings set self_service_vaults = true;
alter table public.app_settings alter column self_service_vaults set default true;

create or replace function public.guard_self_service_vault()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
begin
  -- Backend (service role) e dono da plataforma não passam por aqui
  if v_profile is null or public.is_platform_admin() then
    return new;
  end if;
  if (select count(*) from public.vaults v join public.accounts a on a.id = v.account_id
      where a.owner_profile_id = v_profile and v.status <> 'archived')
     >= (select self_service_vault_limit from public.app_settings where id) then
    raise exception 'vault limit reached' using errcode = '53400';
  end if;
  if (select count(*) from public.vaults where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many requests' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger vaults_self_service_guard before insert on public.vaults
  for each row execute function public.guard_self_service_vault();

alter table public.analytics_events drop constraint analytics_events_event_check;
alter table public.analytics_events add constraint analytics_events_event_check check (event in
  ('page_view', 'plans_view', 'plan_click', 'cta_click', 'lead_form_start', 'lead_submit',
   'login_view', 'nfc_open', 'checkout_start', 'checkout_paid', 'signup_start', 'signup_done'));

revoke execute on function public.guard_self_service_vault() from public, anon, authenticated;
grant execute on function public.guard_self_service_vault() to authenticated;
