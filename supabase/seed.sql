-- Seed de DESENVOLVIMENTO LOCAL apenas (supabase db reset).
-- Não contém administradores: crie o primeiro com `npm run bootstrap:admin`.
-- As migrações já criam configurações, grupo da família e cápsulas iniciais.
update public.app_settings set expected_birth_date = '2027-03-15' where id;
