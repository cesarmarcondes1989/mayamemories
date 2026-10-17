-- Marca definida: "Guardei pra você" (guardeipravoce.com.br).
-- Só troca se ainda estiver com o nome provisório (respeita o que o dono já editou).
update public.app_settings set brand_name = 'Guardei pra você' where brand_name = 'Baú de Memórias';
update public.app_settings set brand_slogan = 'O baú da família para a criança abrir quando crescer.'
where brand_slogan = 'Memórias de família que esperam a hora certa de serem descobertas.';
alter table public.app_settings alter column brand_name set default 'Guardei pra você';
alter table public.app_settings alter column brand_slogan set default 'O baú da família para a criança abrir quando crescer.';
