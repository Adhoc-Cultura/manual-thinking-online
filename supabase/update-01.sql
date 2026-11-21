-- Manual Thinking en línia: actualització 01
-- Afegeix la funció que l'eina fa servir per modificar només una part d'un document
-- (temporitzador, notes, missió...) sense esborrar la resta.
-- Executeu aquest fitxer sencer a l'SQL Editor (botó Run). Es pot executar més d'una vegada.

-- Fusió recursiva de dos objectes JSON: els camps de "b" sobreescriuen els de "a",
-- i els objectes niats es fusionen en lloc de substituir-se.
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  k text;
  result jsonb;
begin
  if a is null or jsonb_typeof(a) <> 'object' or b is null or jsonb_typeof(b) <> 'object' then
    return b;
  end if;
  result := a;
  for k in select jsonb_object_keys(b) loop
    if jsonb_typeof(b -> k) = 'object' and jsonb_typeof(result -> k) = 'object' then
      result := jsonb_set(result, array[k], public.jsonb_deep_merge(result -> k, b -> k));
    else
      result := jsonb_set(result, array[k], b -> k);
    end if;
  end loop;
  return result;
end $$;

-- Actualitza un document existent fusionant-hi els camps nous.
-- Respecta les regles de seguretat (RLS) de la taula docs.
create or replace function public.docs_update(p_collection text, p_id text, p_patch jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  new_data jsonb;
begin
  update public.docs
     set data = public.jsonb_deep_merge(data, p_patch)
   where collection = p_collection and id = p_id
  returning data into new_data;
  if new_data is null then
    raise exception 'El document no existeix' using errcode = 'P0002';
  end if;
  return new_data;
end $$;

revoke all on function public.docs_update(text, text, jsonb) from public, anon;
grant execute on function public.docs_update(text, text, jsonb) to authenticated;
