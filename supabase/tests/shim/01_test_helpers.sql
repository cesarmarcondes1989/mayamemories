-- Helpers de teste (apenas no banco descartável de testes)
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create table tests.kv (k text primary key, v text);
grant select, insert on tests.kv to anon, authenticated, service_role;

create or replace function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
declare v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'FAIL (expected error): %', p_label;
  end if;
end $$;

create or replace function tests.expect_ok(p_sql text, p_label text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  raise exception 'FAIL (unexpected error: %): %', sqlerrm, p_label;
end $$;

create or replace function tests.expect_count(p_sql text, p_expected bigint, p_label text) returns void language plpgsql as $$
declare v bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into v;
  if v <> p_expected then
    raise exception 'FAIL (expected %, got %): %', p_expected, v, p_label;
  end if;
end $$;

create or replace function tests.expect_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then
    raise exception 'FAIL (expected true): %', p_label;
  end if;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
