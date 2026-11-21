-- Manual Thinking en línia: actualització 02
-- Dona permisos explícits sobre la taula docs a les persones que entren a l'eina.
-- Els projectes nous de Supabase no sempre els donen automàticament.
-- Es pot executar més d'una vegada.

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.docs to authenticated;
grant execute on function public.jsonb_deep_merge(jsonb, jsonb) to authenticated;
grant execute on function public.docs_update(text, text, jsonb) to authenticated;
